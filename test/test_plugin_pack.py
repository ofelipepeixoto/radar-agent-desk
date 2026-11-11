import json
import runpy
import shutil
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent.parent
PACKER = runpy.run_path(str(ROOT / "scripts" / "pack-plugin.py"))


class PluginPackagingTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / PACKER["NAME"]
        shutil.copytree(PACKER["SOURCE"], self.source)

    def test_reproducible_archive_contains_only_instruction_files(self):
        first = PACKER["pack"](self.source, self.root / "one.zip")
        second = PACKER["pack"](self.source, self.root / "two.zip")
        self.assertEqual(first.read_bytes(), second.read_bytes())
        with ZipFile(first) as archive:
            prefix = f"{PACKER['NAME']}/"
            self.assertEqual(set(archive.namelist()), {prefix + x for x in PACKER["MEMBERS"]})
            self.assertIsNone(archive.testzip())
            self.assertEqual(archive.read(prefix + "plugin.json"), (self.source / "plugin.json").read_bytes())

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
