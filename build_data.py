# -*- coding: utf-8 -*-
"""
Собирает данные всех наборов из datasets.json в файлы для офлайн-дашборда.

На выходе:
    manifest.js      — список наборов, подписи, таксономии (грузится всегда)
    data_<key>.js    — данные одного набора (грузится только активный)

index.html читает manifest.js, определяет активный набор по #хэшу и
подгружает только его data_<key>.js — поэтому число наборов не замедляет
открытие дашборда.

Запуск (пересобрать всё):        python build_data.py
Пересобрать один набор:          python build_data.py --only politics
Наборы без файлов данных пропускаются — это нормально, пока топ не собран.
"""
from __future__ import unicode_literals

import argparse
import io
import json
import os
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST_PATH = os.path.join(HERE, "datasets.json")


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def write_js(path, text):
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return os.path.getsize(path)


def build_set(key, cfg, generated_at):
    registry_path = os.path.normpath(os.path.join(HERE, cfg["registry"]))
    titles_path = os.path.normpath(os.path.join(HERE, cfg["titles"]))

    registry = load_json(registry_path)
    if registry is None:
        return None, "нет файла реестра"
    titles = load_json(titles_path, {}) or {}

    channels = []
    for c in registry:
        vs = c.get("video_stats") or {}
        bm = c.get("batch_metrics") or {}
        cid = c["id"]
        channels.append({
            "id": cid,
            "name": c.get("name"),
            "channel_id": c.get("channel_id"),
            "subs": c.get("subs"),
            "role": c.get("role"),
            "excluded": bool(c.get("excluded", False)),
            "exclude_reason": c.get("exclude_reason"),
            "in_top": c.get("in_top"),
            "rank_note": c.get("rank_note"),
            "category": bm.get("category"),
            "bm_format": bm.get("format"),
            "faceless": bm.get("faceless"),
            "monetized": bm.get("monetized"),
            "rpm": bm.get("rpm"),
            "avg_views": bm.get("avg_views"),
            "video_count_period": vs.get("video_count_period"),
            "video_count_for_views": vs.get("video_count_for_views"),
            "median_views": vs.get("median_views"),
            "avg_duration_sec": vs.get("avg_duration_sec"),
            "frequency_per_week": vs.get("frequency_per_week"),
            "median_to_subs_ratio": vs.get("median_to_subs_ratio"),
            "median_engagement_rate": vs.get("median_engagement_rate"),
            "engagement_sample_size": vs.get("engagement_sample_size"),
            "shorts_count_period": vs.get("shorts_count_period"),
            "shorts_median_views": vs.get("shorts_median_views"),
            "has_video_data": cid in titles,
        })

    by_id = {c["id"]: c for c in channels}

    videos = []
    for cid, entry in titles.items():
        chan = by_id.get(cid)
        if chan and chan.get("excluded"):
            continue
        med = chan.get("median_views") if chan else None
        for v in entry.get("videos", []):
            views = v.get("views")
            ratio = (views / med) if (views is not None and med) else None
            videos.append({
                "video_id": v.get("video_id"),
                "title": v.get("title"),
                "publishDate": v.get("publishDate"),
                "views": views,
                "duration_sec": v.get("duration_sec"),
                "theme_id": v.get("theme_id"),
                "format": v.get("format"),
                "hero": v.get("hero"),
                "cid": cid,
                "channel_name": entry.get("name"),
                "channel_id": entry.get("channel_id"),
                "channel_median_views": med,
                "ratio": ratio,
            })

    payload = {
        "dataset": key,
        "label": cfg.get("label"),
        "generated_at": generated_at,
        "themes": cfg.get("themes") or {},
        "channels": channels,
        "videos": videos,
    }
    js = "window.__DASHBOARD_DATA__ = " + json.dumps(
        payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    size = write_js(os.path.join(HERE, "data_%s.js" % key), js)
    return {"channels": len(channels), "videos": len(videos), "bytes": size}, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="пересобрать только один набор")
    args = ap.parse_args()

    manifest = load_json(MANIFEST_PATH)
    if not manifest:
        raise SystemExit("Не найден datasets.json рядом со скриптом.")

    generated_at = datetime.now(timezone.utc).isoformat()
    summary = {}

    for key in manifest["order"]:
        cfg = manifest["sets"][key]
        if args.only and key != args.only:
            prev = load_json(os.path.join(HERE, "manifest_state.json"), {}) or {}
            if key in prev:
                summary[key] = prev[key]
            continue
        stats, err = build_set(key, cfg, generated_at)
        if err:
            print("  – %-9s пропущен (%s)" % (key, err))
            continue
        summary[key] = stats
        print("  ✓ %-9s каналов %-4d видео %-6d  %.1f МБ" % (
            key, stats["channels"], stats["videos"], stats["bytes"] / 1048576.0))

    write_js(os.path.join(HERE, "manifest_state.json"),
             json.dumps(summary, ensure_ascii=False, indent=1))

    nav = {
        "order": [k for k in manifest["order"] if k in summary],
        "pending": [k for k in manifest["order"] if k not in summary],
        "generated_at": generated_at,
        "sets": {},
    }
    for key in manifest["order"]:
        cfg = manifest["sets"][key]
        nav["sets"][key] = {
            "label": cfg.get("label"),
            "short": cfg.get("short"),
            "theme_axis": cfg.get("theme_axis") or "Карта тем",
            "file": "data_%s.js" % key,
            "ready": key in summary,
            "channels": summary.get(key, {}).get("channels"),
            "videos": summary.get(key, {}).get("videos"),
        }

    write_js(os.path.join(HERE, "manifest.js"),
             "window.__DATASETS__ = " + json.dumps(nav, ensure_ascii=False) + ";\n")
    print("Готово. Наборов с данными: %d, ждут сбора: %d" % (len(nav["order"]), len(nav["pending"])))


if __name__ == "__main__":
    main()
