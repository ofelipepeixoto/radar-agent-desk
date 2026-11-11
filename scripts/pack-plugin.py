#!/usr/bin/env python3
"""Validate and package this repo's instruction-only plugin (Python stdlib)."""

import argparse
import json
import re
import stat
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
MAX_MEMBER = 64 * 1024


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


def validate(source):
    """Return validated bytes and version; not a host-acceptance check."""
    require(source.is_dir() and not source.is_symlink(), "Diretório de plugin inválido.")
    files = {}
    for path in sorted(source.rglob("*")):
        mode = path.lstat().st_mode
        if stat.S_ISDIR(mode):
            continue
        name = path.relative_to(source).as_posix()
        require(stat.S_ISREG(mode) and name in MEMBERS, f"Componente inesperado: {name}")
        require(path.stat().st_size <= MAX_MEMBER, f"Componente muito grande: {name}")
        with path.open("rb") as handle:
            raw = handle.read(MAX_MEMBER + 1)
        require(0 < len(raw) <= MAX_MEMBER, f"Tamanho inválido: {name}")
        files[name] = raw
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
    return files, version


def pack(source, output=None):
    files, version = validate(source)
    destination = (output or ROOT / "dist" / f"{NAME}-{version}.zip").resolve()
    require(destination.suffix.lower() == ".zip" and not destination.is_relative_to(source.resolve()),
            "Escolha um arquivo .zip fora do diretório do plugin.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "x", compression=ZIP_STORED) as archive:
        for name, raw in sorted(files.items()):
            entry = ZipInfo(f"{NAME}/{name}", date_time=(1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(entry, raw)
    with ZipFile(destination) as archive:
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
