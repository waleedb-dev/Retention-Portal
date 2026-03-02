#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

API_BASE_URL = "https://services.leadconnectorhq.com"
API_VERSION = "2021-07-28"
DEFAULT_GHL_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/137.0.0.0 Safari/537.36"
)

SUBAGENT_ALIASES = {
    "ambition bpo": "ambition",
    "arktech bpo": "ark tech",
    "argon comm bpo": "argon comm",
    "cerberus bpo": "cerberus bpo",
    "corebiz bpo": "corebiz",
    "crown connect bpo": "crown connect bpo",
    "crossnotch bpo": "crossnotch",
    "digicon bpo": "digicon",
    "downtown": "downtown bpo",
    "downtown bpo": "downtown bpo",
    "everest bpo": "everest bpo",
    "everline solution bpo": "everline solution",
    "growthonics bpo": "growthonics bpo",
    "maverick communications": "maverick",
    "optimum bpo": "optimum bpo",
    "plexi bpo": "plexi",
    "pro soliutions bpo": "pro solutions bpo",
    "seller": "sellerz bpo",
    "sellerz": "sellerz bpo",
    "sellerz bpo": "sellerz bpo",
    "stratix": "stratix bpo",
    "stratix bpo": "stratix bpo",
    "the zupax marketing": "zupax marketing",
    "trust link": "trust link",
    "vize": "vize bpo",
    "vyn bpo": "vyn",
}


def normalize_whitespace(value: str) -> str:
    return " ".join(value.split())


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = value.replace("\u00A0", " ")
    value = value.strip().lower()
    value = re.sub(r"[^\w\s]", " ", value)
    return normalize_whitespace(value)


def call_center_candidates(value: str) -> list[str]:
    normalized = normalize_text(value)
    if not normalized:
        return []

    candidates = [normalized]
    alias = SUBAGENT_ALIASES.get(normalized)
    if alias and alias not in candidates:
        candidates.append(alias)

    simplified = re.sub(
        r"\b(bpo|communications|communication|marketing|tech|solutions|solution|comm)\b",
        "",
        normalized,
    )
    simplified = normalize_whitespace(simplified)
    if simplified and simplified not in candidates:
        candidates.append(simplified)

    return candidates


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def build_ghl_headers(token: str, version: str, location_id: str | None) -> dict[str, str]:
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
        "Version": version,
        "User-Agent": os.environ.get("GHL_API_USER_AGENT", DEFAULT_GHL_USER_AGENT),
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Origin": "https://app.gohighlevel.com",
        "Referer": "https://app.gohighlevel.com/",
    }
    if location_id:
        headers["Location-Id"] = location_id
    return headers


def resolve_token_from_subagents(
    subagents_path: Path,
    subagent_name: str | None,
    call_center: str | None,
) -> tuple[str, dict[str, Any]]:
    parsed = load_json(subagents_path)
    if not isinstance(parsed, list):
        raise RuntimeError("subagent json must contain a top-level array")

    subagents_by_name: dict[str, dict[str, Any]] = {}
    ordered: list[dict[str, Any]] = []
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").strip()
        if not name:
            continue
        subagents_by_name[normalize_text(name)] = entry
        ordered.append(entry)

    if subagent_name:
        candidate = subagents_by_name.get(normalize_text(subagent_name))
        if candidate is None:
            raise RuntimeError(f'Subagent "{subagent_name}" not found in {subagents_path}')
        token = str(candidate.get("access_token") or candidate.get("api_key") or "").strip()
        if not token:
            raise RuntimeError(f'Subagent "{subagent_name}" has no access_token/api_key')
        return token, candidate

    if call_center:
        for candidate_name in call_center_candidates(call_center):
            if candidate_name in subagents_by_name:
                candidate = subagents_by_name[candidate_name]
                token = str(candidate.get("access_token") or candidate.get("api_key") or "").strip()
                if not token:
                    raise RuntimeError(f'Call center match "{candidate.get("name")}" has no access_token/api_key')
                return token, candidate

        normalized_call_center = normalize_text(call_center)
        best_match: dict[str, Any] | None = None
        best_score = -1
        for entry in ordered:
            normalized_name = normalize_text(str(entry.get("name") or ""))
            if not normalized_name:
                continue
            if normalized_name in normalized_call_center or normalized_call_center in normalized_name:
                score = min(len(normalized_name), len(normalized_call_center))
                if score > best_score:
                    best_match = entry
                    best_score = score

        if best_match is None:
            raise RuntimeError(f'No subagent match found for call center "{call_center}"')

        token = str(best_match.get("access_token") or best_match.get("api_key") or "").strip()
        if not token:
            raise RuntimeError(f'Call center match "{best_match.get("name")}" has no access_token/api_key')
        return token, best_match

    raise RuntimeError("Provide either --token, --subagent-name, or --call-center")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Fetch one GHL contact note")
    parser.add_argument("--contact-id", required=True, help="GHL contact id")
    parser.add_argument("--note-id", required=True, help="GHL note id")
    parser.add_argument("--token", help="Bearer token / private integration token")
    parser.add_argument("--subagent-name", help="Resolve token from notes/subagent.json by subagent name")
    parser.add_argument("--call-center", help="Resolve token from notes/subagent.json by deal call center")
    parser.add_argument("--subagents-json", default="notes/subagent.json")
    parser.add_argument("--output", default="notes/single_ghl_note.json")
    parser.add_argument("--version", default=API_VERSION)
    return parser


def main() -> int:
    args = build_parser().parse_args()

    token = (args.token or "").strip()
    resolved_subagent: dict[str, Any] | None = None
    if not token:
        token, resolved_subagent = resolve_token_from_subagents(
            subagents_path=(Path.cwd() / args.subagents_json).resolve(),
            subagent_name=args.subagent_name,
            call_center=args.call_center,
        )

    url = (
        f"{API_BASE_URL}/contacts/{quote(args.contact_id)}/notes/{quote(args.note_id)}"
    )
    headers = build_ghl_headers(
        token=token,
        version=args.version,
        location_id=str(resolved_subagent.get("location_id") or "").strip() if resolved_subagent else None,
    )

    print("[ghl-single-note] request", {
        "contact_id": args.contact_id,
        "note_id": args.note_id,
        "version": args.version,
        "subagent_name": resolved_subagent.get("name") if resolved_subagent else None,
    })

    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
            parsed = json.loads(body)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"[ghl-single-note] HTTP {exc.code}: {body}")
        return 1
    except URLError as exc:
        print(f"[ghl-single-note] URL error: {exc}")
        return 1

    output_path = (Path.cwd() / args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "contact_id": args.contact_id,
        "note_id": args.note_id,
        "version": args.version,
        "subagent": {
            "id": resolved_subagent.get("id") if resolved_subagent else None,
            "name": resolved_subagent.get("name") if resolved_subagent else None,
            "location_id": resolved_subagent.get("location_id") if resolved_subagent else None,
        },
        "response": parsed,
    }
    output_path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[ghl-single-note] wrote {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
