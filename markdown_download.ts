import { isProbablyReaderable, Readability } from "npm:@mozilla/readability@^0.5.0";
import { DOMParser } from "npm:linkedom@0.16.10";
import { marked } from "npm:marked@12.0.1";
import { getSubtitles } from "npm:youtube-captions-scraper@^2.0.1";
import { YouTube } from "npm:youtube-sr@4.3.11";

const isCloudflareWorker = typeof Request !== "undefined" && typeof Response !== "undefined";

// init async loading of modules
const AgentMarkdownImport = isCloudflareWorker ? import("npm:agentmarkdown@6.0.0") : null;
const TurndownService = isCloudflareWorker ? null : await import("npm:turndown@^7.1.3");

/**
 * converts HTML to markdown
 * @returns markdown in string
 */
export async function html2markdown(html: string): Promise<string> {
  if (AgentMarkdownImport) {
    // TurndownService doesn't work on cf
    // Dynamically import AgentMarkdown when running in Cloudflare Worker
    const { AgentMarkdown } = await AgentMarkdownImport;
    return await AgentMarkdown.produce(html);
  } else {
    // Dynamically import TurndownService otherwise
    return new (await TurndownService)().turndown(html);
  }
}

/**
 * extracts article from html
 * then converts it to md
 * @returns markdown in string
 */
export async function readability2markdown(html: string): Promise<{ title: string; markdown: string }> {
  const doc = await (new DOMParser().parseFromString(html, "text/html"));

  const reader = new Readability(doc);
  const article = reader.parse();

  const markdown = await html2markdown(article?.content || "");
  return { title: doc.title.textContent, markdown };
}

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

function fudgeURL(url: string) {
  try {
    return new URL(url);
  } catch (e) {
    // console.log("Url parsing failed", e.stack);
    return new URL("https://" + url);
  }
}

function processInput(req: Request) {
  let ret = {
    url: undefined as undefined | URL,
    response: undefined as undefined | Response,
  };
  const myurl = new URL(req.url);
  let pathname = myurl.pathname.substring(1) + myurl.search;
  if (!pathname.startsWith("http")) {
    const urlAsFormParam = myurl.searchParams.get("url");
    if (urlAsFormParam) {
      pathname = urlAsFormParam;
    } else if (pathname.length < 2) {
      ret.response = response(
        generate_ui(
          "URL to convert to markdown:",
          "https://www.val.town/v/taras/markdown_download",
          "markdown.download",
        ),
        "text/html",
      );
      return ret;
    }
  }
  ret.url = fudgeURL(pathname);
  return ret;
}

export default async function(req: Request): Promise<Response> {
  const action = processInput(req);
  const url = action.url;
  if (!url) {
    return action.response!;
  }

  const html = await fetch(url.toString(), {
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
  }).then(r => r.text());

  let title = "";
  let markdown = "";
  const youtubeVideoID = getYoutubeVideoID(url);
  if (youtubeVideoID) {
    let transcript = "## Generated Transcription\n\n";
    try {
      const arr = (await getSubtitles({
        videoID: youtubeVideoID,
      })) as { text: string }[];
      transcript += arr.map(({ text }) => text).join("\n\n");
    } catch (e) {
      transcript = `Failed to fetch transcript ${e}`;
    }
    const y = await YouTube.getVideo(url.toString());
    const header = "# " + y.title + "\n\n" + y.embedHTML() + `\n\n<div style="white-space: pre-wrap;">\n`
      + y.description + "\n</div>\n\n";
    markdown = header + transcript;
  } else {
    const r = await readability2markdown(html);
    title = r.title;
    markdown = r.markdown;
  }
  const markdown_extended = markdown + "\n\n" + url;
  if (req.headers.get("Accept")?.includes("text/html")) {
    const body = await marked.parse(markdown_extended);
    const html = `
<html lang="en" class="js-focus-visible" data-js-focus-visible=""><head>
  <meta charset="utf-8">
  <title>${title}</title>
  </head>
  ${body}
  </html>
    `;
    return response(html, "text/html");
  } else {
    return response(markdown_extended);
  }
}

/**
 * Simple UI that takes a url
 */
export function generate_ui(input_description: string, link: string, link_text: string): string {
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
                    <label for="url" class="block text-sm font-medium text-gray-700">${input_description}</label>
                    <input type="text" id="url" name="url" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                </div>
                <button type="submit" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Submit
                </button>
            </form>
            <a href="${link}" class="block mt-4 text-indigo-600 hover:text-indigo-700">${link_text}</a>
        </div>
    </div>
</body>
</html>
`;
  return html;
}
