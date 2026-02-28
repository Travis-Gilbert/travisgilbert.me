def generate_description(video) -> str:
    """
    Generates YouTube description from video project data:
    - Hook from first scene's script text (first sentence)
    - Key points from scene titles (excluding b-roll)
    - Source links from sources JSON
    - Chapter markers from youtube_chapters JSON
    """
    lines = []

    # Hook: first sentence of the first scene's script
    first_scene = video.scenes.first()
    if first_scene and first_scene.script_text:
        hook = first_scene.script_text.split(".")[0] + "."
        lines.append(hook)
        lines.append("")

    # Key points from scene titles (skip b-roll, which has no dialogue)
    scenes = video.scenes.exclude(scene_type="broll")
    if scenes.exists():
        lines.append("In this video:")
        for scene in scenes:
            lines.append(f"- {scene.title}")
        lines.append("")

    # Sources with links
    if video.sources:
        lines.append("Sources:")
        for source in video.sources:
            title = source.get("title", "Untitled")
            url = source.get("url", "")
            if url:
                lines.append(f"- {title}: {url}")
            else:
                lines.append(f"- {title}")
        lines.append("")

    # Chapter markers
    if video.youtube_chapters:
        lines.append("CHAPTERS:")
        for chapter in video.youtube_chapters:
            tc = chapter.get("timecode", "0:00")
            label = chapter.get("label", "")
            lines.append(f"{tc} - {label}")

    return "\n".join(lines)
