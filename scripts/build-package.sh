#!/bin/bash
# Assemble BitGraph-Sealed-Exam — the release zip — from THIS repository.
#
#   scripts/build-package.sh [out-dir]        default: ~/Desktop/sealed exam outreach
#
# The zip is this tree with the five packages packed to tarballs and the
# verification path vendored, so it runs with nothing installed and no network.
#
# ⚠️ It builds from the repository, and only from the repository. The first
# version of this script lived on a local branch and packed from there, which
# is how a copyright sweep and a version bump landed in the published source
# while the zip kept shipping tarballs made from the old tree (2026-09-14).
# There is one source of truth and it is the thing people can read.
#
# ⚠️ THE PROVIDER SDK IS NOT VENDORED. It is an optional dependency of
# exam-ask, loaded only when asking, and the verifier install omits optional
# dependencies.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$HOME/Desktop/sealed exam outreach}"
pkg="$out/BitGraph-Sealed-Exam"
say() { printf '\033[2m%s\033[0m\n' "$*"; }

say "building the five packages"
( cd "$root" && npm run build >/dev/null )

say "packing"
mkdir -p "$pkg/packages"; rm -f "$pkg/packages"/*.tgz
for p in exam-bank exam-core exam-ask exam-verify exam-cli; do
  ( cd "$root/packages/$p" && npm pack --pack-destination "$pkg/packages" >/dev/null 2>&1 )
done
ls "$pkg/packages"

say "vendoring the verification path"
rm -rf "$pkg/verifier"; mkdir -p "$pkg/verifier"
cp "$root/verifier/exam.mjs" "$root/verifier/demo.mjs" "$pkg/verifier/"
# Generated from what was just packed, so no file here holds a version number.
{
  printf '{\n  "name": "sealed-exam-verifier",\n  "private": true,\n  "type": "module",\n'
  printf '  "description": "Vendored verification path for the sealed exam package; run node verifier/exam.mjs",\n'
  printf '  "dependencies": {\n'
  first=1
  for t in exam-ask exam-bank exam-cli exam-core exam-verify; do
    f=$(cd "$pkg/packages" && ls "mikeargento-$t"-*.tgz)
    [ $first -eq 1 ] || printf ',\n'; first=0
    printf '    "@mikeargento/%s": "file:../packages/%s"' "$t" "$f"
  done
  printf '\n  }\n}\n'
} > "$pkg/verifier/package.json"
( cd "$pkg/verifier" && npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund >/dev/null 2>&1 \
  && rm -rf node_modules/.package-lock.json package-lock.json )
[ ! -d "$pkg/verifier/node_modules/@anthropic-ai" ] || { echo "FAIL the provider SDK is in the verifier tree"; exit 1; }

say "the sittings"
rm -rf "$pkg/demo"; mkdir -p "$pkg/demo"
cp -R "$root/demo/." "$pkg/demo/"
find "$pkg" -name .DS_Store -delete
find "$pkg/demo" \( -name report.html -o -name verdict.json \) -delete

say "the documents"
for f in README.md SPEC.md LICENSE.txt THIRD-PARTY-NOTICES.txt; do cp "$root/$f" "$pkg/$f"; done

say "the zip"
( cd "$out" && rm -f BitGraph-Sealed-Exam.zip && zip -qr BitGraph-Sealed-Exam.zip BitGraph-Sealed-Exam -x '*.DS_Store' )
du -h "$out/BitGraph-Sealed-Exam.zip" | cut -f1

say "smoke: the table, offline, from the zip's own tree"
( cd "$pkg" && node verifier/demo.mjs | tail -2 )
