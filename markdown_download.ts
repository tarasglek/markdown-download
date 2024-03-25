import { isProbablyReaderable, Readability } from "npm:@mozilla/readability@^0.5.0";
import { AgentMarkdown } from "npm:agentmarkdown@6.0.0";
import { DOMParser } from "npm:linkedom@0.16.10";
import { marked } from "npm:marked@12.0.1";
import TurndownService from "npm:turndown@^7.1.3";
import { getSubtitles } from "npm:youtube-captions-scraper@^2.0.1";

function getYoutubeVideoID(url: URL): string | null {
  const regExp = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
  const match = url.href.match(regExp);
  return match ? match[1] : null;
}

function response(message: string, contentType = "text/markdown"): Response {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Content-Type", contentType);
  return new Response(message, {
    status: 200,
    headers: headers,
  });
}

function err(msg: string): Response {
  const errorMessage = JSON.stringify({
    error: {
      message: msg,
      code: 400,
    },
  });
  return response(errorMessage, "application/json");
}

async function markdown2html(html: string) {
  try {
    return new TurndownService().turndown(html);
  } catch (e) {
    console.log("Turndown failed, falling back to AgentMarkdown", e.stack);
  }
  return await AgentMarkdown.produce(html);
}

function fudgeURL(url: string) {
  try {
    return new URL(url);
  } catch (e) {
    // console.log("Url parsing failed", e.stack);
    return new URL("https://" + url);
  }
}

export default async function(req: Request): Promise<Response> {
  const myurl = new URL(req.url);
  let pathname = myurl.pathname.substring(1) + myurl.search;
  if (!pathname.startsWith("http")) {
    const urlAsFormParam = myurl.searchParams.get("url");
    if (urlAsFormParam) {
      pathname = urlAsFormParam;
    } else if (pathname.length < 2) {
      return response(html, "text/html");
    }
  }
  const url = fudgeURL(pathname);

  const youtubeVideoID = getYoutubeVideoID(url);
  if (youtubeVideoID) {
    const arr = (await getSubtitles({
      videoID: youtubeVideoID,
    })) as { text: string }[];
    const description = "## Generated Transcription\n\n"
      + arr.map(({ text }) => text).join("\n");
    return response(description);
  }

  const dom_promise = fetch(url.toString(), {
    method: req.method,
    headers: new Headers({
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-User": "?1",
      "Sec-Fetch-Dest": "document",
      "Referer": "https://www.google.com/",
      "sec-ch-ua": `"Not A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"`,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": `"macOS"`,
      "Upgrade-Insecure-Requests": "1",
      // Add any other headers you need here
    }),
  })
    .then(r => r.text())
    .then(async html => new DOMParser().parseFromString(html, "text/html"));
  const doc = await dom_promise;

  const reader = new Readability(doc);
  const article = reader.parse();

  const markdown = await markdown2html(article?.content || "") + "\n\n" + url;

  if (req.headers.get("Accept")?.includes("text/html")) {
    const body = await marked.parse(markdown);
    const html = `
<html lang="en" class="js-focus-visible" data-js-focus-visible=""><head>
  <meta charset="utf-8">
  <title>${doc.title}</title>
  </head>
  ${body}
  </html>
    `;
    return response(html, "text/html");
  } else {
    return response(markdown);
  }
}

const html = `
<!DOCTYPE html>
<html>
<head>
    <title>markdown.download</title>
    <!-- Tailwind CSS -->
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-100">
    <div class="min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full bg-white rounded-lg shadow-md p-6">
            <form class="space-y-4">
                <div>
                    <label for="url" class="block text-sm font-medium text-gray-700">Url to convert:</label>
                    <input type="text" id="url" name="url" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                </div>
                <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Submit
                </button>
            </form>
            <a href="https://www.val.town/v/taras/markdown_download" class="block mt-4 text-indigo-600 hover:text-indigo-700">markdown.download</a>
        </div>
    </div>
</body>
</html>
`;
