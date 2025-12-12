import httpx
from datetime import datetime
from typing import Optional

DEFAULT_TIMEOUT = 60.0

class WikipediaService:
    
    def __init__(self, timeout: float = DEFAULT_TIMEOUT):
        self.timeout = timeout
    
    def _get_urls(self, lang: str = "en"):
        return {
            "base": f"https://{lang}.wikipedia.org/api/rest_v1",
            "api": f"https://{lang}.wikipedia.org/w/api.php"
        }
    
    async def get_on_this_day(self, month: int = None, day: int = None, lang: str = "en") -> list:
        today = datetime.now()
        month = month or today.month
        day = day or today.day
        urls = self._get_urls("en")  # On This Day only available in English Wikipedia
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{urls['base']}/feed/onthisday/events/{month}/{day}",
                headers={"User-Agent": "GoInsights/1.0"},
                timeout=self.timeout
            )
            if response.status_code != 200:
                return []
            
            data = response.json()
            events = []
            for event in data.get("events", [])[:20]:
                pages = event.get("pages", [])
                thumbnail = pages[0].get("thumbnail", {}).get("source") if pages else None
                events.append({
                    "year": event.get("year"),
                    "text": event.get("text", ""),
                    "title": pages[0].get("title") if pages else "",
                    "description": pages[0].get("description", "") if pages else "",
                    "thumbnail": thumbnail,
                    "extract": pages[0].get("extract", "") if pages else "",
                    "media_count": 0,
                    "image_count": 0,
                    "video_count": 0,
                    "audio_count": 0
                })
            
            if events:
                events = await self._add_media_counts_to_events(client, events, urls["api"])
            
            return events
    
    async def _add_media_counts_to_events(self, client: httpx.AsyncClient, events: list, api_url: str) -> list:
        titles = [e["title"] for e in events if e.get("title")]
        if not titles:
            return events
            
        response = await client.get(
            api_url,
            params={
                "action": "query",
                "titles": "|".join(titles[:20]),
                "prop": "images",
                "imlimit": "max",
                "format": "json"
            },
            headers={"User-Agent": "GoInsights/1.0"},
            timeout=15.0
        )
        if response.status_code != 200:
            return events
        
        data = response.json()
        title_counts = {}
        
        for page in data.get("query", {}).get("pages", {}).values():
            title = page.get("title", "")
            images = page.get("images", [])
            counts = self._count_media_files(images)
            title_counts[title] = counts
        
        for e in events:
            counts = title_counts.get(e["title"], {"total": 0, "images": 0, "videos": 0, "audio": 0})
            e["media_count"] = counts["total"]
            e["image_count"] = counts["images"]
            e["video_count"] = counts["videos"]
            e["audio_count"] = counts["audio"]
        
        return events

    async def search(self, query: str, limit: int = 20, lang: str = "en", with_media_count: bool = True) -> list:
        urls = self._get_urls(lang)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                urls["api"],
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "srlimit": limit,
                    "format": "json",
                    "srprop": "snippet|titlesnippet"
                },
                headers={"User-Agent": "GoInsights/1.0"},
                timeout=self.timeout
            )
            if response.status_code != 200:
                return []
            
            data = response.json()
            results = []
            for item in data.get("query", {}).get("search", []):
                result = {
                    "title": item.get("title"),
                    "snippet": item.get("snippet", "").replace("<span class=\"searchmatch\">", "").replace("</span>", ""),
                    "pageid": item.get("pageid"),
                    "media_count": 0
                }
                results.append(result)
            
            if with_media_count and results:
                results = await self._add_media_counts(client, results, urls["api"])
            
            return results
    
    async def _add_media_counts(self, client: httpx.AsyncClient, results: list, api_url: str) -> list:
        titles = [r["title"] for r in results]
        response = await client.get(
            api_url,
            params={
                "action": "query",
                "titles": "|".join(titles[:20]),
                "prop": "images",
                "imlimit": "max",
                "format": "json"
            },
            headers={"User-Agent": "GoInsights/1.0"},
            timeout=15.0
        )
        if response.status_code != 200:
            return results
        
        data = response.json()
        title_counts = {}
        
        for page in data.get("query", {}).get("pages", {}).values():
            title = page.get("title", "")
            images = page.get("images", [])
            counts = self._count_media_files(images)
            title_counts[title] = counts
        
        for r in results:
            counts = title_counts.get(r["title"], {"total": 0, "images": 0, "videos": 0, "audio": 0})
            r["media_count"] = counts["total"]
            r["image_count"] = counts["images"]
            r["video_count"] = counts["videos"]
            r["audio_count"] = counts["audio"]
        
        return results
    
    def _count_media_files(self, files: list) -> dict:
        skip_keywords = [
            "icon", "logo", "flag", "commons-logo", "symbol", "button", "signature", 
            "edit", "ambox", "padlock", "wikidata", "question", "gnome", "crystal",
            "nuvola", "ooui", "octicons", "emojione", "twemoji", "info", "warning",
            "red_pencil", "blue_pencil", "increase", "decrease", "steady", "check",
            "x_mark", "yes", "no", "location", "dot", "marker", "template", "stub",
            "disambig", "portal", "wikimedia", "wiki-", "wikinews", "wiktionary"
        ]
        image_exts = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".tif")
        video_exts = (".ogv", ".webm", ".mp4", ".mpeg", ".mov", ".avi")
        audio_exts = (".ogg", ".mp3", ".wav", ".flac", ".oga", ".opus", ".mid", ".midi")
        
        counts = {"images": 0, "videos": 0, "audio": 0, "total": 0}
        
        for f in files:
            name = f.get("title", "").lower()
            if any(k in name for k in skip_keywords):
                continue
            if ".svg" in name or name.endswith(".svg"):
                continue
            
            # Check file extension at end of filename
            if name.endswith(image_exts):
                counts["images"] += 1
            elif name.endswith(video_exts):
                counts["videos"] += 1
            elif name.endswith(audio_exts):
                counts["audio"] += 1
        
        counts["total"] = counts["images"] + counts["videos"] + counts["audio"]
        return counts

    async def get_categories(self) -> list:
        return [
            {"id": "wars", "name": "Wars & Conflicts", "query": "List of wars"},
            {"id": "discoveries", "name": "Scientific Discoveries", "query": "Timeline of scientific discoveries"},
            {"id": "inventions", "name": "Inventions", "query": "Timeline of historic inventions"},
            {"id": "disasters", "name": "Natural Disasters", "query": "List of natural disasters"},
            {"id": "explorers", "name": "Explorers", "query": "List of explorers"},
            {"id": "revolutions", "name": "Revolutions", "query": "List of revolutions"},
            {"id": "empires", "name": "Empires", "query": "List of largest empires"},
            {"id": "leaders", "name": "World Leaders", "query": "List of state leaders"},
            {"id": "ancient", "name": "Ancient Civilizations", "query": "Ancient history"},
            {"id": "space", "name": "Space Exploration", "query": "Timeline of space exploration"},
        ]

    async def get_article(self, title: str, lang: str = "en") -> dict:
        urls = self._get_urls(lang)
        async with httpx.AsyncClient() as client:
            summary_resp = await client.get(
                f"{urls['base']}/page/summary/{title.replace(' ', '_')}",
                headers={"User-Agent": "GoInsights/1.0"},
                timeout=self.timeout
            )
            
            if summary_resp.status_code != 200:
                return {"error": "Article not found"}
            
            summary = summary_resp.json()
            
            media = await self._get_article_media(client, title, urls["api"])
            
            if len(media) < 8:
                commons_media = await self._search_commons(client, title)
                existing_urls = {m["url"] for m in media}
                for cm in commons_media:
                    if cm["url"] not in existing_urls:
                        media.append(cm)
            
            sections = await self._get_article_sections(client, title, urls["api"])
            
            images = [m for m in media if m["type"] == "image"]
            videos = [m for m in media if m["type"] == "video"]
            audios = [m for m in media if m["type"] == "audio"]
            
            # Count from article vs commons
            article_media = [m for m in media if m.get("source") != "commons"]
            commons_media = [m for m in media if m.get("source") == "commons"]
            
            return {
                "title": summary.get("title"),
                "description": summary.get("description", ""),
                "extract": summary.get("extract", ""),
                "thumbnail": summary.get("thumbnail", {}).get("source"),
                "images": images,
                "videos": videos,
                "audios": audios,
                "media": media,
                "sections": sections,
                "url": summary.get("content_urls", {}).get("desktop", {}).get("page", ""),
                "media_count": len(media),
                "image_count": len(images),
                "video_count": len(videos),
                "audio_count": len(audios),
                "article_media_count": len(article_media),
                "commons_media_count": len(commons_media),
                "has_more_commons": True  # Commons always has more
            }

    async def _search_commons(self, client: httpx.AsyncClient, query: str, limit: int = 50, offset: int = 0, media_filter: str = "all") -> list:
        filetype = "filetype:bitmap" if media_filter == "images" else "filetype:video" if media_filter == "videos" else ""
        response = await client.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": f"{filetype} {query}".strip(),
                "gsrlimit": limit,
                "gsroffset": offset,
                "prop": "imageinfo",
                "iiprop": "url|extmetadata|mime|size",
                "iiurlwidth": 800,
                "format": "json"
            },
            headers={"User-Agent": "GoInsights/1.0"},
            timeout=30.0
        )
        
        if response.status_code != 200:
            return []
        
        data = response.json()
        media = []
        skip_keywords = [
            "icon", "logo", "flag", "commons-logo", "symbol", "button", 
            "gnome", "crystal", "nuvola", "ooui", "octicons", "emojione", 
            "twemoji", "template", "stub", "disambig", "portal", "wikimedia"
        ]
        
        for page in data.get("query", {}).get("pages", {}).values():
            title = page.get("title", "")
            lower_title = title.lower()
            
            if any(skip in lower_title for skip in skip_keywords):
                continue
            if ".svg" in lower_title:
                continue
            
            info = page.get("imageinfo", [{}])[0]
            url = info.get("thumburl") or info.get("url")
            mime = info.get("mime", "")
            
            if not url:
                continue
            
            # Determine media type from MIME
            if "video" in mime:
                media_type = "video"
            elif "audio" in mime:
                media_type = "audio"
            else:
                media_type = "image"
            
            meta = info.get("extmetadata", {})
            metadata = self._extract_metadata(meta)
            
            media.append({
                "title": title.replace("File:", ""),
                "url": url,
                "original_url": info.get("url"),
                "type": media_type,
                "mime": mime,
                "width": info.get("width"),
                "height": info.get("height"),
                "size": info.get("size"),
                "description": metadata["description"],
                "object_name": metadata["object_name"],
                "categories": metadata["categories"],
                "artist": metadata["artist"],
                "date": metadata["date"],
                "license": metadata["license"],
                "source": "commons"
            })
        
        return media
    
    async def search_commons_media(self, query: str, limit: int = 50, offset: int = 0, media_filter: str = "all") -> dict:
        async with httpx.AsyncClient() as client:
            media = await self._search_commons(client, query, limit, offset, media_filter)
            return {"media": media, "has_more": len(media) >= limit}

    async def _get_article_media(self, client: httpx.AsyncClient, title: str, api_url: str) -> list:
        response = await client.get(
            api_url,
            params={
                "action": "query",
                "titles": title,
                "prop": "images",
                "imlimit": "max",
                "format": "json"
            },
            headers={"User-Agent": "GoInsights/1.0"},
            timeout=30.0
        )
        
        if response.status_code != 200:
            return []
        
        data = response.json()
        pages = data.get("query", {}).get("pages", {})
        
        image_titles = []
        video_titles = []
        audio_titles = []
        skip_keywords = [
            "icon", "logo", "flag", "commons-logo", "symbol", "button", "signature", 
            "edit", "ambox", "padlock", "wikidata", "question", "gnome", "crystal",
            "nuvola", "ooui", "octicons", "emojione", "twemoji", "info", "warning",
            "red_pencil", "blue_pencil", "increase", "decrease", "steady", "check",
            "x_mark", "yes", "no", "location", "dot", "marker", "template", "stub",
            "disambig", "portal", "wikimedia", "wiki-", "wikinews", "wiktionary"
        ]
        image_exts = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".tif")
        video_exts = (".ogv", ".webm", ".mp4", ".mpeg", ".mov", ".avi")
        audio_exts = (".ogg", ".mp3", ".wav", ".flac", ".oga", ".opus", ".mid", ".midi")
        
        for page in pages.values():
            for item in page.get("images", []):
                item_title = item.get("title", "")
                lower_title = item_title.lower()
                
                if any(skip in lower_title for skip in skip_keywords):
                    continue
                if ".svg" in lower_title:
                    continue
                
                if lower_title.endswith(image_exts):
                    image_titles.append(item_title)
                elif lower_title.endswith(video_exts):
                    video_titles.append(item_title)
                elif lower_title.endswith(audio_exts):
                    audio_titles.append(item_title)
        
        media = []
        media.extend(await self._get_media_urls(client, image_titles, "image", api_url))
        media.extend(await self._get_media_urls(client, video_titles, "video", api_url))
        media.extend(await self._get_media_urls(client, audio_titles, "audio", api_url))
        
        return media

    def _clean_html(self, text: str) -> str:
        """Remove HTML tags from text"""
        import re
        clean = re.sub(r'<[^>]+>', '', text)
        clean = re.sub(r'\s+', ' ', clean).strip()
        return clean[:500]
    
    def _extract_metadata(self, meta: dict) -> dict:
        """Extract useful metadata from Wikipedia's extmetadata"""
        def get_val(key: str) -> str:
            return self._clean_html(meta.get(key, {}).get("value", "")) if meta.get(key) else ""
        
        description = get_val("ImageDescription")
        object_name = get_val("ObjectName")
        categories = get_val("Categories")
        artist = get_val("Artist")
        date = get_val("DateTimeOriginal") or get_val("DateTime")
        license_name = get_val("LicenseShortName")
        
        # Build a meaningful context string
        context_parts = []
        if object_name and object_name != description[:len(object_name)]:
            context_parts.append(object_name)
        if description:
            context_parts.append(description)
        
        return {
            "description": " - ".join(context_parts) if context_parts else "",
            "object_name": object_name,
            "categories": categories,
            "artist": artist,
            "date": date,
            "license": license_name
        }

    async def _get_media_urls(self, client: httpx.AsyncClient, titles: list, media_type: str, api_url: str) -> list:
        if not titles:
            return []
        
        media = []
        batch_size = 50
        
        for i in range(0, len(titles), batch_size):
            batch = titles[i:i + batch_size]
            response = await client.get(
                api_url,
                params={
                    "action": "query",
                    "titles": "|".join(batch),
                    "prop": "imageinfo",
                    "iiprop": "url|extmetadata|mime|size|dimensions",
                    "iiurlwidth": 800 if media_type == "image" else None,
                    "format": "json"
                },
                headers={"User-Agent": "GoInsights/1.0"},
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                continue
            
            data = response.json()
            for page in data.get("query", {}).get("pages", {}).values():
                info = page.get("imageinfo", [{}])[0]
                url = info.get("thumburl") or info.get("url")
                if url:
                    meta = info.get("extmetadata", {})
                    metadata = self._extract_metadata(meta)
                    
                    media.append({
                        "title": page.get("title", "").replace("File:", ""),
                        "url": url,
                        "original_url": info.get("url"),
                        "type": media_type,
                        "mime": info.get("mime", ""),
                        "width": info.get("width"),
                        "height": info.get("height"),
                        "size": info.get("size"),
                        "description": metadata["description"],
                        "object_name": metadata["object_name"],
                        "categories": metadata["categories"],
                        "artist": metadata["artist"],
                        "date": metadata["date"],
                        "license": metadata["license"],
                        "source": "article"
                    })
        
        return media

    async def _get_article_sections(self, client: httpx.AsyncClient, title: str, api_url: str) -> list:
        response = await client.get(
            api_url,
            params={
                "action": "parse",
                "page": title,
                "prop": "sections|text",
                "format": "json"
            },
            headers={"User-Agent": "GoInsights/1.0"},
            timeout=30.0
        )
        
        if response.status_code != 200:
            return []
        
        data = response.json()
        sections = []
        
        for sec in data.get("parse", {}).get("sections", [])[:10]:
            if sec.get("line") and sec.get("toclevel", 0) <= 2:
                sections.append({
                    "title": sec.get("line"),
                    "index": sec.get("index"),
                    "level": sec.get("toclevel")
                })
        
        return sections

    async def get_section_content(self, title: str, section_index: str, lang: str = "en") -> str:
        urls = self._get_urls(lang)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                urls["api"],
                params={
                    "action": "query",
                    "titles": title,
                    "prop": "extracts",
                    "exsectionformat": "plain",
                    "explaintext": True,
                    "exlimit": 1,
                    "format": "json"
                },
                headers={"User-Agent": "GoInsights/1.0"},
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                return ""
            
            data = response.json()
            pages = data.get("query", {}).get("pages", {})
            for page in pages.values():
                return page.get("extract", "")[:3000]
            return ""

