import importlib.util
import io
import pathlib
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("notes", pathlib.Path(__file__).resolve().parents[1] / "scripts/zip-changelog.py")
notes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notes)


class VersionNotesTest(unittest.TestCase):
    def read(self, documents):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            for name, value in documents.items():
                archive.writestr(name, value)
        with zipfile.ZipFile(buffer) as archive:
            return notes.version_notes(archive, "1.2.103")

    def test_exact_root_and_version(self):
        self.assertEqual(self.read({"CHANGELOG.md": "## [1.2.103] - 2026-11-25\r\n- 변경됨\r\n## 1.2.10\n- 이전\n"}), "## [1.2.103] - 2026-11-25\n- 변경됨\n")
        self.assertEqual(self.read({"docs/CHANGELOG.md": "## 1.2.103\nwrong file"}), "")
        self.assertEqual(self.read({"CHANGELOG.md": "## 1.2.1030\nwrong version"}), "")


if __name__ == "__main__":
    unittest.main()
