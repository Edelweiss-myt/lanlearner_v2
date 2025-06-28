// src/services/notionService.ts

// NOTION_API_VERSION is handled by the Netlify function
// Use the proxy path for local development and Netlify deployment
const NOTION_API_BASE_URL = '/.netlify/functions/notion-proxy';

// NOTION_API_KEY and NOTION_PARENT_PAGE_ID are no longer used on the client-side.
// They are securely handled by the Netlify Function.

import { SyllabusItem, KnowledgePointItem } from '../types'; // Import types

export interface NotionRichText {
  type: 'text';
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  plain_text?: string;
  href?: string | null;
}

export type NotionBlockType =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'quote'
  | 'divider'
  | 'image'
  | 'toggle'
  | 'table_of_contents';

export interface NotionBlock {
  object: 'block';
  type: NotionBlockType;
  [key: string]: any;
}

export const createNotionParagraphBlock = (richText: NotionRichText[], color?: string): NotionBlock => ({
  object: 'block',
  type: 'paragraph',
  paragraph: { rich_text: richText, ...(color && { color }) },
});

export const createNotionHeadingBlock = (level: 1 | 2 | 3, richText: NotionRichText[], color?: string): NotionBlock => {
  const type = `heading_${level}` as 'heading_1' | 'heading_2' | 'heading_3';
  return {
    object: 'block',
    type: type,
    [type]: { rich_text: richText, ...(color && { color }) },
  };
};

export const createNotionQuoteBlock = (richText: NotionRichText[], color?: string): NotionBlock => ({
  object: 'block',
  type: 'quote',
  quote: { rich_text: richText, ...(color && { color }) },
});

export const createNotionDividerBlock = (): NotionBlock => ({
    object: 'block',
    type: 'divider',
    divider: {},
});

export const createNotionToggleBlock = (richText: NotionRichText[], children: NotionBlock[]): NotionBlock => ({
    object: 'block',
    type: 'toggle',
    toggle: {
        rich_text: richText,
        children: children,
    }
});

export const createNotionImageBlock = (url: string, caption?: NotionRichText[]): NotionBlock => ({
    object: 'block',
    type: 'image',
    image: {
        type: 'external',
        external: { url },
        ...(caption && { caption }),
    }
});

export const createNotionTableOfContentsBlock = (): NotionBlock => ({
    object: 'block',
    type: 'table_of_contents',
    table_of_contents: {},
});


async function notionAPIRequest(endpoint: string, method: string, body?: object) {
  // Client-side no longer handles API key or specific Notion version header.
  // These are managed by the Netlify Function proxy.
  const response = await fetch(`${NOTION_API_BASE_URL}${endpoint}`, {
    method: method,
    headers: {
      'Content-Type': 'application/json', // Netlify function will receive this
    },
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Failed to parse error response from proxy."}));
    console.error('Error from Netlify Function / Notion API:', errorData);
    throw new Error(`Request to Notion via proxy failed: ${response.status} ${response.statusText}. Message: ${errorData.message || 'Unknown error'}`);
  }
  return response.json();
}

export async function createNotionPageWithBlocks(title: string, blocks: NotionBlock[]): Promise<{ id: string, url: string }> {
  // Client-side no longer needs to check for NOTION_PARENT_PAGE_ID.
  // The Netlify Function will handle adding the parent_id.
  
  const blocksWithToc = [createNotionTableOfContentsBlock(), ...blocks];
  const initialBlocks = blocksWithToc.slice(0, 100);

  // The client sends a simplified payload to the Netlify function.
  // The Netlify function then adds parent_id and constructs the full Notion properties.
  const clientPayload = {
    title: title,
    children: initialBlocks,
  };

  const createdPage = await notionAPIRequest('/pages', 'POST', clientPayload);

  // Append remaining blocks if any
  if (blocksWithToc.length > 100) {
    for (let i = 100; i < blocksWithToc.length; i += 100) {
      const chunk = blocksWithToc.slice(i, i + 100);
      // The endpoint for appending blocks should be part of the path sent to the Netlify function
      await appendBlocksToPage(createdPage.id, chunk);
    }
  }

  return { id: createdPage.id, url: createdPage.url };
}

export async function appendBlocksToPage(pageBlockId: string, blocks: NotionBlock[]): Promise<void> {
  if (blocks.length === 0) return;
  const body = { children: blocks };
  // The endpoint for the Netlify function will be like '/blocks/PAGE_ID/children'
  await notionAPIRequest(`/blocks/${pageBlockId}/children`, 'PATCH', body);
}

// The checkNotionConfig function is removed as client-side no longer manages Notion keys/IDs.

export const generateNotionBlocksForSyllabusStructure = (
    currentParentId: string | null,
    currentSyllabus: SyllabusItem[],
    allKnowledgePoints: KnowledgePointItem[],
    depth: number,
    conceptualRootIdToSkip: string | null
  ): NotionBlock[] => {
    const blocks: NotionBlock[] = [];
    const childrenCategories = currentSyllabus.filter(item => item.parentId === currentParentId);

    childrenCategories.forEach(categoryItem => {
      if (categoryItem.id !== conceptualRootIdToSkip) {
        if (depth === 0) {
          blocks.push(createNotionHeadingBlock(1, [{ type: 'text', text: { content: categoryItem.title } }]));
        } else if (depth === 1) {
          blocks.push(createNotionHeadingBlock(2, [{ type: 'text', text: { content: categoryItem.title } }]));
        }
      }

      const kpsUnderThisCategory = allKnowledgePoints.filter(kp => kp.syllabusItemId === categoryItem.id);
      
      kpsUnderThisCategory.forEach(kp => {
        blocks.push(createNotionHeadingBlock(3, [{ type: 'text', text: { content: kp.title } }]));
        
        const contentLines = kp.content.split('\n').filter(line => line.trim() !== '');
        contentLines.forEach(line => {
            blocks.push(createNotionParagraphBlock([{ type: 'text', text: { content: line } }]));
        });

        if (kp.imageUrl) {
            const imageNameText = kp.imageName || 'Image';
            const imageBlock = createNotionImageBlock(kp.imageUrl);
            const toggleBlock = createNotionToggleBlock(
                [{ type: 'text', text: { content: imageNameText } }],
                [imageBlock]
            );
            blocks.push(toggleBlock);
        }

        if (kp.notes) {
          const noteLines = kp.notes.split('\n').filter(line => line.trim() !== '');
          if (noteLines.length > 0) {
            noteLines.forEach(line => {
                blocks.push(createNotionQuoteBlock([{ type: 'text', text: { content: line } }]));
            });
          }
        }
      });
      
      blocks.push(...generateNotionBlocksForSyllabusStructure(
        categoryItem.id,
        currentSyllabus,
        allKnowledgePoints,
        depth + 1,
        conceptualRootIdToSkip
      ));
    });

    return blocks;
  };
