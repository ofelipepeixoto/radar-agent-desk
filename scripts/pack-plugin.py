#!/usr/bin/env python3
"""Validate and package this repo's instruction-only plugin (Python stdlib)."""

import argparse
import errno
import json
import os
import re
import stat
from contextlib import contextmanager
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent.parent
NAME = "radar-agent-desk-review"
SKILL = "revisar-radar-agent-desk"
SOURCE = ROOT / "plugin" / NAME
SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
SKILL_PATH = f"skills/{SKILL}/SKILL.md"
POLICY_PATH = f"skills/{SKILL}/references/consulta-nativa.md"
MEMBERS = {"plugin.json", SKILL_PATH, POLICY_PATH}
DIRECTORIES = {p.as_posix() for name in MEMBERS for p in Path(name).parents if p != Path(".")}
MAX_MEMBER = 64 * 1024
SECURE_FD_SUPPORTED = (
    all(hasattr(os, flag) for flag in ("O_DIRECTORY", "O_NOFOLLOW", "O_NONBLOCK"))
    and os.open in os.supports_dir_fd
    and os.mkdir in os.supports_dir_fd
    and os.scandir in os.supports_fd
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "O manifesto contém campo duplicado.")
        result[key] = value
    return result


def text_value(value):
    return isinstance(value, str) and bool(value.strip())


def open_at(name, flags, dir_fd, mode=0o777):
    try:
        return os.open(name, flags | os.O_NOFOLLOW, mode, dir_fd=dir_fd)
    except OSError as exc:
        if exc.errno in (errno.ELOOP, errno.ENOTDIR):
            raise ValueError(f"Link simbólico ou diretório inválido: {name}") from exc
        raise


@contextmanager
def open_directory(path, *, create=False):
    require(SECURE_FD_SUPPORTED, "Use um ambiente POSIX compatível, como Linux ou WSL, para empacotar.")
    absolute = Path(os.path.abspath(path))
    flags = os.O_RDONLY | os.O_DIRECTORY
    fd = os.open(absolute.anchor, flags | os.O_NOFOLLOW)
    try:
        for part in absolute.parts[1:]:
            if create:
                try:
                    os.mkdir(part, 0o700, dir_fd=fd)
                except FileExistsError:
                    pass
            child = open_at(part, flags, fd)
            os.close(fd)
            fd = child
        yield fd
    finally:
        os.close(fd)


def member_state(metadata):
    return (metadata.st_dev, metadata.st_ino, metadata.st_mode, metadata.st_nlink,
            metadata.st_size, metadata.st_mtime_ns, metadata.st_ctime_ns)


def read_member(dir_fd, name, label):
    # Validate the object we opened, not metadata for a path a writer could replace.
    fd = open_at(name, os.O_RDONLY | os.O_NONBLOCK, dir_fd)
    try:
        metadata = os.fstat(fd)
        require(stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1,
                f"Componente inesperado ou com múltiplos links: {label}")
        require(0 < metadata.st_size <= MAX_MEMBER, f"Tamanho inválido: {label}")
        with os.fdopen(fd, "rb", closefd=False) as handle:
            raw = handle.read(MAX_MEMBER + 1)
        require(len(raw) == metadata.st_size and member_state(os.fstat(fd)) == member_state(metadata),
                f"Componente mudou durante a leitura: {label}")
        return raw
    finally:
        os.close(fd)


def read_tree(dir_fd, files, prefix=""):
    # Open each component relative to an already opened directory. Never follow a symlink.
    with os.scandir(dir_fd) as entries:
        for entry in entries:
            name = prefix + entry.name
            if name in DIRECTORIES:
                child = open_at(entry.name, os.O_RDONLY | os.O_DIRECTORY, dir_fd)
                try:
                    read_tree(child, files, name + "/")
                finally:
                    os.close(child)
            else:
                require(name in MEMBERS, f"Componente inesperado: {name}")
                files[name] = read_member(dir_fd, entry.name, name)


def validate(source):
    """Return validated bytes and version; not a host-acceptance check."""
    files = {}
    with open_directory(source) as dir_fd:
        read_tree(dir_fd, files)
    require(files.keys() == MEMBERS, "O manifesto, a skill ou a política estão ausentes.")

    manifest = json.loads(files["plugin.json"].decode("utf-8"), object_pairs_hook=unique_object)
    require(isinstance(manifest, dict) and set(manifest) == {
        "$schema", "name", "version", "description", "author", "repository", "extensions"
    }, "Estrutura inesperada no manifesto de instruções.")
    require(manifest["$schema"] == SCHEMA and manifest["name"] == NAME, "Schema ou identidade inválidos.")
    version = manifest["version"]
    require(isinstance(version, str) and re.fullmatch(r"(?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*)){2}", version),
            "A versão deve seguir o formato X.Y.Z.")
    require(text_value(manifest["description"]), "Descrição obrigatória.")
    require(manifest["repository"] == "https://github.com/ofelipepeixoto/radar-agent-desk",
            "Repositório do manifesto inválido.")
    author = manifest["author"]
    require(isinstance(author, dict) and set(author) == {"name"} and text_value(author["name"]),
            "Autor inválido.")
    extensions = manifest["extensions"]
    require(isinstance(extensions, dict) and set(extensions) == {"com.openai"}, "Extensão inesperada.")
    settings = extensions["com.openai"]
    require(isinstance(settings, dict) and set(settings) == {"interface"},
            "O pacote de instruções só aceita a extensão de apresentação.")
    interface = settings["interface"]
    fields = {"displayName", "shortDescription", "longDescription", "developerName", "category", "defaultPrompt"}
    require(isinstance(interface, dict) and set(interface) == fields | {"capabilities"} and
            all(text_value(interface[k]) for k in fields), "Apresentação inválida.")
    require(len(interface["shortDescription"]) <= 30 and interface["category"] == "Productivity" and
            interface["capabilities"] == ["Interactive"], "Categoria, subtítulo ou capacidade inválidos.")

    skill = files[SKILL_PATH].decode("utf-8").replace("\r\n", "\n")
    # This author's narrow YAML frontmatter shape: name + JSON-quoted string.
    match = re.match(r'\A---\nname: ([a-z0-9-]+)\ndescription: ("(?:[^"\\\n]|\\.)*")\n---\n(.+)\Z',
                     skill, re.DOTALL)
    require(match and match[1] == SKILL and text_value(json.loads(match[2])) and text_value(match[3]),
            "Frontmatter ou corpo da skill inválido.")
    require("(references/consulta-nativa.md)" in match[3] and text_value(files[POLICY_PATH].decode("utf-8")),
            "Política nativa ausente ou sem referência na skill.")
    with open_directory(ROOT) as dir_fd:
        files["LICENSE"] = read_member(dir_fd, "LICENSE", "LICENSE")
    return files, version


def pack(source, output=None):
    files, version = validate(source)
    destination = Path(os.path.abspath(output or ROOT / "dist" / f"{NAME}-{version}.zip"))
    require(destination.suffix.lower() == ".zip" and not destination.is_relative_to(Path(os.path.abspath(source))),
            "Escolha um arquivo .zip fora do diretório do plugin.")
    with open_directory(destination.parent, create=True) as dir_fd:
        fd = open_at(destination.name, os.O_RDWR | os.O_CREAT | os.O_EXCL, dir_fd, 0o600)
    with os.fdopen(fd, "w+b") as handle:
        with ZipFile(handle, "w", compression=ZIP_STORED) as archive:
            for name, raw in sorted(files.items()):
                entry = ZipInfo(f"{NAME}/{name}", date_time=(1980, 1, 1, 0, 0, 0))
                entry.create_system = 3
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
                archive.writestr(entry, raw)
        # Check the same open file, without resolving the destination a second time.
        handle.seek(0)
        with ZipFile(handle) as archive:
            expected = {f"{NAME}/{name}": raw for name, raw in files.items()}
            require(archive.namelist() == sorted(expected) and archive.testzip() is None and
                    all(archive.read(name) == raw for name, raw in expected.items()),
                    "O arquivo empacotado não corresponde à fonte validada.")
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Destino ZIP. Arquivos existentes não são substituídos.")
    parser.add_argument("--check", action="store_true", help="Verifica os arquivos sem gerar ZIP.")
    args = parser.parse_args()
    if args.check and args.output:
        parser.error("--check e --output não podem ser usados juntos.")
    try:
        if args.check:
            _, version = validate(SOURCE)
            print(f"{NAME} {version}: estrutura local válida; aceite no ChatGPT não verificado.")
        else:
            print(pack(SOURCE, args.output))
    except (OSError, ValueError) as exc:
        parser.exit(1, f"Falha no pacote: {exc}\n")


if __name__ == "__main__":
    main()
