import json
from pathlib import Path


def clean_label(value: str) -> str:
    """
    Normalise a major label by:
    - trimming whitespace
    - stripping leading/trailing quote characters
    - removing any remaining quote or asterisk characters
    """
    if value is None:
        return value

    s = str(value).strip()

    # Strip balanced leading/trailing quotes repeatedly if present
    while len(s) >= 2 and s[0] == s[-1] and s[0] in {'"', "'"}:
        s = s[1:-1].strip()

    # Remove any remaining quote / asterisk characters
    for ch in ('"', "'", '*'):
        s = s.replace(ch, '')

    return s.strip()


def clean_mapping(mapping: dict) -> int:
    """Clean all labels in a mapping and return how many were changed."""
    changed = 0
    for key, value in list(mapping.items()):
        if isinstance(value, str):
            cleaned = clean_label(value)
            if cleaned != value:
                mapping[key] = cleaned
                changed += 1
    return changed


def main() -> None:
    path = Path("dist/data/majors_bachelor_meta.json")
    data = json.loads(path.read_text(encoding="utf-8"))

    total_changed = 0
    for section in ("two_digit", "four_digit", "six_digit"):
        mapping = data.get(section)
        if isinstance(mapping, dict):
            total_changed += clean_mapping(mapping)

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Cleaned labels: {total_changed}")


if __name__ == "__main__":
    main()

