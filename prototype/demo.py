import os
import pty
import select
import time
import re


class ADBShell:
    def __init__(self):
        self.pid, self.fd = pty.fork()

        if self.pid == 0:
            os.execvp("adb", ["adb", "shell"])

        time.sleep(1)
        self._read()

    def _read(self, timeout=0.15):
        data = bytearray()

        while True:
            ready, _, _ = select.select(
                [self.fd],
                [],
                [],
                timeout
            )

            if not ready:
                break

            try:
                chunk = os.read(self.fd, 8192)
            except OSError:
                break

            if not chunk:
                break

            data.extend(chunk)

            # First read ke baad short timeout
            timeout = 0.05

        return bytes(data)

    def autocomplete(self, text):
        # Input shell ko do
        os.write(self.fd, text.encode())

        # TAB
        os.write(self.fd, b"\t")

        time.sleep(0.2)

        raw = self._read()

        return self._extract_suggestions(raw, text)

    def _extract_suggestions(self, raw, original):
        text = raw.decode("utf-8", errors="ignore")

        # ANSI escape sequences remove
        text = re.sub(r"\x1b\[[0-9;?]*[ -/]*[@-~]", "", text)

        # CR remove
        text = text.replace("\r", "")

        # Backspace sequences remove
        text = re.sub(r"\x08+", "", text)

        # Bell remove
        text = text.replace("\x07", "")

        lines = text.split("\n")

        suggestions = []

        for line in lines:
            line = line.strip()

            if not line:
                continue

            # Prompt wali line skip
            if "$" in line or "#" in line:
                continue

            # Shell ke completion output me generally
            # whitespace separated entries hote hain.
            parts = line.split()

            for part in parts:
                if part not in suggestions:
                    suggestions.append(part)

        return suggestions

    def close(self):
        try:
            os.write(self.fd, b"exit\n")
        except:
            pass

        try:
            os.close(self.fd)
        except:
            pass


if __name__ == "__main__":
    shell = ADBShell()

    try:
        while True:
            value = input("Input: ")

            if value in ("exit", "quit"):
                break

            suggestions = shell.autocomplete(value)

            print("\nSuggestions:")
            for suggestion in suggestions:
                print(" ", suggestion)

    finally:
        shell.close()