// netlify/functions/notion-proxy.mjs

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

export const handler = async (event, context) => {
  const { NOTION_API_KEY, NOTION_PARENT_PAGE_ID } = process.env;

  if (!NOTION_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Notion API Key is not configured in Netlify environment variables." }),
    };
  }

  // Extract the Notion API endpoint from the path
  // e.g., if event.path is '/.netlify/functions/notion-proxy/pages', notionEndpoint will be '/pages'
  // or if event.path is '/notion-proxy/pages' (if function is called without .netlify/functions prefix in some contexts like local dev with simpler proxy)
  let notionEndpoint = event.path.replace(/^\/\.netlify\/functions\/notion-proxy/, '').replace(/^\/notion-proxy/, '');
  if (!notionEndpoint.startsWith('/')) {
    notionEndpoint = `/${notionEndpoint}`;
  }
  
  const targetUrl = `${NOTION_API_BASE}${notionEndpoint}`;

  const headers = {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': NOTION_API_VERSION,
    'Content-Type': 'application/json',
  };

  let body = event.body;

  // Special handling for page creation to inject parent_page_id and format title
  if (notionEndpoint === '/pages' && event.httpMethod === 'POST' && event.body) {
    if (!NOTION_PARENT_PAGE_ID) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Notion Parent Page ID is not configured in Netlify environment variables." }),
        };
    }
    try {
      const originalBody = JSON.parse(event.body);
      const notionPagePayload = {
        parent: { page_id: NOTION_PARENT_PAGE_ID },
        properties: {
          title: [
            {
              type: 'text',
              text: {
                content: originalBody.title || 'Untitled Export', // Use title from client
              },
            },
          ],
        },
        children: originalBody.children || [], // Pass through children blocks from client
      };
      body = JSON.stringify(notionPagePayload);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid JSON body for page creation.", error: e.message }),
      };
    }
  }


  try {
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: headers,
      ...(event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD' && body && { body: body }),
    });

    const responseData = await response.json().catch(() => null); // Try to parse JSON, but don't fail if not JSON

    return {
      statusCode: response.status,
      body: responseData ? JSON.stringify(responseData) : await response.text(), // Return JSON if parsed, else text
      headers: { // Pass through important headers if needed, e.g., Content-Type
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      }
    };
  } catch (error) {
    console.error('Error in Notion proxy function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error proxying request to Notion API.', error: error.message }),
    };
  }
};