// Import the default export from the module
import handler, {readability2markdown, html2markdown, generate_ui} from "./main.ts";

/**
 * Markdown magic serving happens here
 */
export { handler as serve, readability2markdown, html2markdown, generate_ui };
