"""Read one version section from a published plugin ZIP without installing it."""
import hashlib
import re
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile


def version_notes(archive, version):
    entries = [e for e in archive.infolist() if e.filename == "CHANGELOG.md"]
    if len(entries) != 1 or entries[0].file_size > 512 * 1024:
        return ""
    with archive.open(entries[0]) as stream:
        data = stream.read(512 * 1024 + 1)
    if len(data) > 512 * 1024:
        return ""
    text = data.decode("utf-8-sig").replace("\r\n", "\n")
    for section in re.split(r"(?m)(?=^##[ \t]+)", text):
        heading = section.partition("\n")[0]
        match = re.match(r"^##\s+\[?v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)\]?(?:\s|$)", heading)
        if match and match[1] == version:
            return section.strip() + "\n"
    return ""


def main(repo, url, digest, length, version):
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != "https" or parsed.netloc != "github.com"
            or not parsed.path.startswith("/" + repo + "/releases/download/")):
        raise ValueError("Unexpected release URL")
    expected = int(length)
    with tempfile.TemporaryFile() as out, urllib.request.urlopen(url, timeout=45) as response:
        checksum = hashlib.sha256()
        while chunk := response.read(1024 * 1024):
            out.write(chunk)
            checksum.update(chunk)
            if out.tell() > expected:
                raise ValueError("Unexpected ZIP size")
        if out.tell() != expected or "sha256:" + checksum.hexdigest() != digest:
            raise ValueError("Release ZIP size or digest mismatch")
        with zipfile.ZipFile(out) as archive:
            sys.stdout.buffer.write(version_notes(archive, version).encode("utf-8"))


if __name__ == "__main__":
    main(*sys.argv[1:])
