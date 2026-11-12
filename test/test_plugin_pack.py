import json
import os
import runpy
import shutil
import stat
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent.parent
PACKER = runpy.run_path(str(ROOT / "scripts" / "pack-plugin.py"))


class PluginPackagingTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.source = self.root / PACKER["NAME"]
        shutil.copytree(PACKER["SOURCE"], self.source)

    def test_reproducible_archive_contains_only_instructions_and_original_license(self):
        first = PACKER["pack"](self.source, self.root / "one.zip")
        second = PACKER["pack"](self.source, self.root / "two.zip")
        self.assertEqual(first.read_bytes(), second.read_bytes())
        with ZipFile(first) as archive:
            prefix = f"{PACKER['NAME']}/"
            self.assertEqual(set(archive.namelist()), {prefix + x for x in PACKER["MEMBERS"] | {"LICENSE"}})
            self.assertIsNone(archive.testzip())
            self.assertEqual(archive.read(prefix + "plugin.json"), (self.source / "plugin.json").read_bytes())
            self.assertEqual(archive.read(prefix + "LICENSE"), (ROOT / "LICENSE").read_bytes())

    def test_rejects_mcp_configuration_and_does_not_write_archive(self):
        (self.source / "mcp.json").write_text("{}", encoding="utf-8")
        destination = self.root / "unsafe.zip"
        with self.assertRaises(ValueError):
            PACKER["pack"](self.source, destination)
        self.assertFalse(destination.exists())

    def test_rejects_host_app_binding_in_manifest(self):
        path = self.source / "plugin.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        manifest["extensions"]["com.openai"]["apps"] = "./.app.json"
        path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaises(ValueError):
            PACKER["validate"](self.source)

    def test_rejects_duplicate_manifest_keys(self):
        path = self.source / "plugin.json"
        raw = path.read_text(encoding="utf-8")
        path.write_text(raw.replace('"version": "0.1.0",', '"version": "0.1.0", "version": "0.1.1",'),
                        encoding="utf-8")
        with self.assertRaises(ValueError):
            PACKER["validate"](self.source)

    def test_rejects_symlinked_policy(self):
        policy = self.source / PACKER["POLICY_PATH"]
        target = self.root / "private.md"
        policy.rename(target)
        policy.symlink_to(target)
        with self.assertRaises(ValueError):
            PACKER["validate"](self.source)

    def test_rejects_member_swapped_to_symlink_during_packaging(self):
        policy = self.source / PACKER["POLICY_PATH"]
        target = self.root / "outside.md"
        target.write_text("Conteúdo fictício fora da origem", encoding="utf-8")
        destination = self.root / "unsafe.zip"
        original_open = os.open
        swapped = False

        def swap_before_open(name, flags, mode=0o777, *, dir_fd=None):
            nonlocal swapped
            if name == policy.name and dir_fd is not None:
                policy.unlink()
                policy.symlink_to(target)
                swapped = True
            return original_open(name, flags, mode, dir_fd=dir_fd)

        with patch.object(os, "open", swap_before_open), self.assertRaises(ValueError):
            PACKER["pack"](self.source, destination)
        self.assertTrue(swapped)
        self.assertFalse(destination.exists())

    def test_does_not_follow_dangling_output_symlink(self):
        target = self.root / "not-created.zip"
        output = self.root / "alias.zip"
        output.symlink_to(target)
        with self.assertRaises(FileExistsError):
            PACKER["pack"](self.source, output)
        self.assertFalse(target.exists())

    def test_rejects_member_with_a_hard_link_outside_source(self):
        policy = self.source / PACKER["POLICY_PATH"]
        target = self.root / "outside.md"
        policy.rename(target)
        os.link(target, policy)
        output = self.root / "unsafe.zip"
        with self.assertRaisesRegex(ValueError, "múltiplos links"):
            PACKER["pack"](self.source, output)
        self.assertFalse(output.exists())

    def test_rejects_in_place_change_during_bounded_read(self):
        policy = self.source / PACKER["POLICY_PATH"]
        target = policy.stat()
        original_fdopen = os.fdopen

        @contextmanager
        def rewrite_after_read(fd, *args, **kwargs):
            with original_fdopen(fd, *args, **kwargs) as handle:
                yield handle
                current = os.fstat(fd)
                if (current.st_dev, current.st_ino) == (target.st_dev, target.st_ino):
                    with policy.open("ab") as writer:
                        writer.write(b"\nConteudo ficticio escrito durante a leitura.")

        output = self.root / "unsafe.zip"
        with patch.object(os, "fdopen", rewrite_after_read), self.assertRaisesRegex(ValueError, "mudou durante"):
            PACKER["pack"](self.source, output)
        self.assertFalse(output.exists())

    def test_creates_private_output_even_with_permissive_umask(self):
        output = self.root / "new-parent" / "nested" / "private.zip"
        previous_umask = os.umask(0)
        try:
            PACKER["pack"](self.source, output)
        finally:
            os.umask(previous_umask)
        self.assertEqual(stat.S_IMODE(output.parent.parent.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(output.parent.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o600)

    def test_no_overwrite_or_archive_inside_source(self):
        dest = self.root / "existing.zip"
        dest.write_bytes(b"existing")
        with self.assertRaises(FileExistsError):
            PACKER["pack"](self.source, dest)
        self.assertEqual(dest.read_bytes(), b"existing")
        with self.assertRaises(ValueError):
            PACKER["pack"](self.source, self.source / "inner.zip")


if __name__ == "__main__":
    unittest.main()
