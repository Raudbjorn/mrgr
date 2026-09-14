#!/usr/bin/env python3
"""Prepare requests, paired schedules, fixed-date templates, and token audits.
Uses only Python's standard library. Does not run the model or score resolutions.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent
NAMESPACE = "gptoss-go-merge-v1"

def strict_json(path):
    def pairs(items):
        out = {}
        for key, value in items:
            if key in out:
                raise ValueError(f"Duplicate JSON key: {key}")
            out[key] = value
        return out
    def bad_constant(value):
        raise ValueError(f"Non-JSON constant: {value}")
    return json.loads(Path(path).read_text(encoding="utf-8"),
                      object_pairs_hook=pairs, parse_constant=bad_constant)

def digest(*values):
    data = json.dumps([NAMESPACE, *values], ensure_ascii=False,
                      separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(data).digest()

def valid_case(case):
    if not isinstance(case, str) or not case.strip() or "\0" in case:
        raise ValueError("Case IDs must be nonempty strings without NUL")
    return case

def seed(case, repeat):
    valid_case(case)
    if not 0 <= repeat < 12:
        raise ValueError("Repeat must be in 0..11")
    return int.from_bytes(digest("seed", case, repeat)[:4], "big") % 2147483647

def write_new(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as f:
        f.write(text)

def json_text(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + "\n"

def request(args):
    messages = strict_json(args.messages)
    if (not isinstance(messages, list) or not messages
            or any(not isinstance(m, dict) or m.get("role") not in
                   ("system", "developer", "user", "assistant")
                   or not isinstance(m.get("content"), str) for m in messages)):
        raise ValueError("Messages must be an existing text-only chat messages array")
    params = strict_json(ROOT / "request-parameters.json")
    body = {**params, "model": args.model, "messages": messages,
            "seed": seed(args.case, args.repeat)}
    write_new(args.output, json_text(body))

def schedule(args):
    cases = strict_json(args.cases)
    if not isinstance(cases, list) or len(cases) != 60:
        raise ValueError("Supply a JSON array of exactly 60 actual case IDs")
    for case in cases:
        valid_case(case)
    if len(set(cases)) != 60:
        raise ValueError("Duplicate case IDs")
    pairs = [(case, repeat) for case in cases for repeat in range(12)]
    pairs.sort(key=lambda p: (digest("order", *p), p))
    if len({seed(*pair) for pair in pairs}) != 720:
        raise ValueError("Seed collision: version the seed namespace before proceeding")
    rows = []
    for case, repeat in pairs:
        conditions = ["boundaries_only", "with_candidates"]
        # Exactly six of each condition first, per case, over its 12 repeats.
        if (digest("first", case)[0] + repeat) % 2:
            conditions.reverse()
        for condition in conditions:
            rows.append({
                "ordinal": len(rows),
                "attempt_id": digest("attempt", case, repeat, condition).hex()[:24],
                "case_id": case, "condition": condition,
                "repeat": repeat, "seed": seed(case, repeat),
            })
    write_new(args.output, "".join(json.dumps(row, ensure_ascii=False) + "\n"
                                   for row in rows))

def freeze(args):
    date = dt.date.fromisoformat(args.date).isoformat()
    if date != args.date:
        raise ValueError("Date must be YYYY-MM-DD")
    source_path = Path(args.input)
    if source_path.suffix == ".json":
        template = strict_json(source_path).get("chat_template")
        if not isinstance(template, str) or not template:
            raise ValueError("props JSON lacks a string chat_template; export the exact template manually")
    else:
        template = source_path.read_bytes().decode("utf-8")
    original_hash = hashlib.sha256(template.encode("utf-8")).hexdigest()
    pattern = r"""strftime_now\s*\(\s*(["'])%Y-%m-%d\1\s*\)"""
    frozen, replacements = re.subn(pattern, json.dumps(date), template)
    if "strftime_now" in frozen:
        raise ValueError("Unrecognized runtime clock expression; inspect and freeze manually")
    if not frozen:
        raise ValueError("Empty template")
    write_new(args.output, frozen)
    print(json_text({
        "source_template_sha256": original_hash,
        "frozen_template_sha256": hashlib.sha256(frozen.encode("utf-8")).hexdigest(),
        "date": date, "date_expressions_replaced": replacements,
        "output": str(Path(args.output).resolve()),
    }), end="")

def post(base, route, data):
    if base.rstrip("/") != "http://127.0.0.1:8089":
        raise ValueError("This profile audits only http://127.0.0.1:8089")
    raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(base + route, data=raw, method="POST",
                                 headers={"Content-Type": "application/json"})
    # Do not accidentally send loopback prompts through an inherited HTTP proxy.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(req, timeout=120) as response:
        return json.load(response)

def audit(args):
    body = strict_json(args.request)
    if body.get("max_tokens") != 16384 or body.get("reasoning_effort") != "high":
        raise ValueError("Request differs from the experiment's generation budget/effort")
    rendered = post(args.base, "/apply-template", body)
    prompt = rendered.get("prompt")
    if not isinstance(prompt, str) or not prompt:
        raise ValueError("Server did not return the templated prompt")
    system = re.match(r"\A<\|start\|>system<\|message\|>(.*?)<\|end\|>", prompt, re.S)
    if system is None or re.findall(r"(?m)^Reasoning:[ \t]*(\w+)[ \t]*$", system.group(1)) != ["high"]:
        raise ValueError("Effective system header must contain exactly one Reasoning: high")
    tokenized = post(args.base, "/tokenize",
                     {"content": prompt, "add_special": True, "parse_special": True})
    tokens = tokenized.get("tokens")
    if not isinstance(tokens, list) or any(type(t) is not int for t in tokens):
        raise ValueError("Tokenizer response lacks integer token IDs")
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=False)
    write_new(out / "prompt.txt", prompt)
    write_new(out / "tokens.json", json_text(tokens))
    count = len(tokens)
    report = {
        "request_sha256": hashlib.sha256(Path(args.request).read_bytes()).hexdigest(),
        "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
        "prompt_tokens": count,
        "maximum_prompt_tokens": 114432,
        "generation_tokens_reserved": 16384,
        "guard_tokens": 256,
        "fits": count <= 114432,
        "usage_crosscheck_required": "Pilot must match usage.prompt_tokens to this token count."
    }
    write_new(out / "audit.json", json_text(report))
    print(json_text(report), end="")
    if not report["fits"]:
        raise ValueError("Prompt exceeds the frozen context budget; do not truncate it silently")

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="command", required=True)
    p = sub.add_parser("request")
    p.add_argument("--messages", required=True)
    p.add_argument("--model", required=True, help="Exact served model path from server-config.json")
    p.add_argument("--case", required=True)
    p.add_argument("--repeat", type=int, required=True)
    p.add_argument("--output", required=True)
    p.set_defaults(fn=request)
    p = sub.add_parser("schedule")
    p.add_argument("--cases", required=True, help="JSON array of the 60 actual case IDs")
    p.add_argument("--output", required=True)
    p.set_defaults(fn=schedule)
    p = sub.add_parser("freeze-template")
    p.add_argument("--input", required=True, help="Saved /props JSON, or exact .jinja template")
    p.add_argument("--date", required=True)
    p.add_argument("--output", required=True)
    p.set_defaults(fn=freeze)
    p = sub.add_parser("audit")
    p.add_argument("--request", required=True)
    p.add_argument("--base", default="http://127.0.0.1:8089")
    p.add_argument("--output-dir", required=True)
    p.set_defaults(fn=audit)
    args = ap.parse_args()
    args.fn(args)

if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError) as exc:
        print(f"Preparation failed: {exc}", file=sys.stderr)
        sys.exit(1)
