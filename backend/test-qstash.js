import { Client } from "@upstash/qstash";

const qstashClient = new Client({ token: "eyJVc2VySUQiOiI1NWY0MDc1ZC0yMjY3LTRlY2YtYWYzOC0xNDAzZTQ0ZDYzMDciLCJQYXNzd29yZCI6IjFjYzdhYzM0ZTIyMzQ3NGFhNDIyNDI3ZmU4MzE3OTc5In0=" });

async function test() {
    try {
        const res = await qstashClient.publishJSON({
            url: "https://example.com/api/qstash",
            body: { message: "test" }
        });
        console.log("Success:", res);
    } catch (err) {
        console.error("Error:", err.message);
    }
}

test();
