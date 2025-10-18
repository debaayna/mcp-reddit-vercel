import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Create the MCP server
const server = new McpServer({
    name: 'reddit-mcp-bot',
    version: '1.0.0'
});

// Register the Reddit posting tool
server.tool(
    'post_to_reddit',
    'Posts content to a specified subreddit',
    {
        subreddit: z.string().describe('The subreddit name (without r/)'),
        title: z.string().describe('Post title'),
        content: z.string().describe('Post content/selftext'),
        require_approval: z.boolean().default(false).describe('Whether post requires approval')
    },
    async ({ subreddit, title, content, require_approval }) => {
        try {
            // Call your AWS Lambda endpoint
            const response = await fetch(
                'https://9wyawpmjib.execute-api.us-east-1.amazonaws.com/default/reddit-mcp-bot',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: 'post',
                        subreddit: subreddit,
                        title: title,
                        selftext: content,
                        require_approval: require_approval
                    })
                }
            );

            const result = await response.json();

            return {
                content: [{
                    type: 'text',
                    text: `✅ Successfully posted to r/${subreddit}!\n\nTitle: ${title}\n\nResponse: ${JSON.stringify(result, null, 2)}`
                }]
            };
        } catch (error) {
            return {
                content: [{
                    type: 'text',
                    text: `❌ Error posting to Reddit: ${error.message}`
                }],
                isError: true
            };
        }
    }
);

// Handle POST requests for MCP communication
app.post('/api/mcp', async (req, res) => {
    try {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true
        });

        res.on('close', () => {
            transport.close();
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error'
                },
                id: null
            });
        }
    }
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`Reddit MCP Server running on http://localhost:${port}/api/mcp`);
});

export default app;
