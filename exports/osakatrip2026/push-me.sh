#!/usr/bin/env bash
set -euo pipefail
REPO="https://github.com/foreverhomboy40442-png/osakatrip2026.git"
WORKDIR=$(mktemp -d)
cd "$WORKDIR"
git clone --depth 1 -b cursor/osaka-kyoto-trip-page-547d https://github.com/foreverhomboy40442-png/restaurant-finance-system.git src
git clone "$REPO" dest || { git init dest && cd dest && git remote add origin "$REPO" && cd ..; }
cd dest
git checkout -B main
cp ../src/exports/osakatrip2026/index.html .
cp ../src/exports/osakatrip2026/README.md .
cp ../src/exports/osakatrip2026/.nojekyll .
git add -A
git status
git commit -m "初版：大阪京都露營瘋女18 行程手冊" || true
git push -u origin main
echo ""
echo "完成！接下來請開啟 Pages："
echo "https://github.com/foreverhomboy40442-png/osakatrip2026/settings/pages"
echo "選 Deploy from a branch → main → / (Root) → Save"
echo ""
echo "正式網址："
echo "https://foreverhomboy40442-png.github.io/osakatrip2026/#s=eyJ1cmwiOiJodHRwczovL3dleXVqcHh3Z3RreHhseWF2d3ZhLnN1cGFiYXNlLmNvIiwia2V5IjoiZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW5kbGVYVnFjSGgzWjNScmVIaHNlV0YyZDNaaElpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzT1RJeU1Ua3hOVFFzSW1WNGNDSTZNakV3TnpjNU5URTFOSDAuUW4wRWtpdlNYZ1YxWXJQUFdVV3JQejJlRnF5UTFqT1NtQ2NIZVV3WW45YyIsInRyaXAiOiJvc2FrYS1reW90by0yMDI2In0"
