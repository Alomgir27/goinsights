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
                    "extract": pages[0].get("extract", "") if pages else ""
                })
            return events

    async def search(self, query: str, limit: int = 10, lang: str = "en") -> list:
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
                results.append({
                    "title": item.get("title"),
                    "snippet": item.get("snippet", "").replace("<span class=\"searchmatch\">", "").replace("</span>", ""),
                    "pageid": item.get("pageid")
                })
            return results

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
            
            return {
                "title": summary.get("title"),
                "description": summary.get("description", ""),
                "extract": summary.get("extract", ""),
                "thumbnail": summary.get("thumbnail", {}).get("source"),
                "images": images,
                "videos": videos,
                "media": media,
                "sections": sections,
                "url": summary.get("content_urls", {}).get("desktop", {}).get("page", "")
            }

    async def _search_commons(self, client: httpx.AsyncClient, query: str) -> list:
        response = await client.get(
            "https://commons.wikimedia.org/w/api.php",
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": f"filetype:bitmap {query}",
                "gsrlimit": 50,
                "prop": "imageinfo",
                "iiprop": "url|extmetadata|mime",
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
        skip_keywords = ["icon", "logo", "flag", "commons-logo", "symbol", "button", "map"]
        
        for page in data.get("query", {}).get("pages", {}).values():
            title = page.get("title", "")
            lower_title = title.lower()
            
            if any(skip in lower_title for skip in skip_keywords):
                continue
            
            info = page.get("imageinfo", [{}])[0]
            url = info.get("thumburl") or info.get("url")
            mime = info.get("mime", "")
            
            if not url:
                continue
            
            media_type = "video" if "video" in mime else "image"
            meta = info.get("extmetadata", {})
            desc = meta.get("ImageDescription", {}).get("value", "")[:200] if meta.get("ImageDescription") else ""
            
            media.append({
                "title": title.replace("File:", ""),
                "url": url,
                "type": media_type,
                "mime": mime,
                "description": desc,
                "source": "commons"
            })
        
        return media

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
        skip_keywords = ["icon", "logo", "flag", "commons-logo", "symbol", "button"]
        
        for page in pages.values():
            for item in page.get("images", []):
                item_title = item.get("title", "")
                lower_title = item_title.lower()
                
                if any(skip in lower_title for skip in skip_keywords):
                    continue
                
                if any(ext in lower_title for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]):
                    image_titles.append(item_title)
                elif any(ext in lower_title for ext in [".ogv", ".webm", ".mp4"]):
                    video_titles.append(item_title)
        
        media = []
        media.extend(await self._get_media_urls(client, image_titles, "image", api_url))
        media.extend(await self._get_media_urls(client, video_titles, "video", api_url))
        
        return media

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
                    "iiprop": "url|extmetadata|mime",
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
                    desc = meta["ImageDescription"].get("value", "")[:200] if meta.get("ImageDescription") else ""
                    media.append({
                        "title": page.get("title", "").replace("File:", ""),
                        "url": url,
                        "type": media_type,
                        "mime": info.get("mime", ""),
                        "description": desc
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

