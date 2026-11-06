"""Applies a builder's locale patch {key: {en, es, zh}} to locales/*.json, keeping key order."""
import collections, json, sys
patch = json.load(open(sys.argv[1]))
for lang in ("en", "es", "zh"):
    path = f"locales/{lang}.json"
    d = json.load(open(path), object_pairs_hook=collections.OrderedDict)
    for k, v in patch.items():
        if lang in v and v[lang] is not None:
            d[k] = v[lang]
    with open(path, "w") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")
print("applied", len(patch), "keys")
