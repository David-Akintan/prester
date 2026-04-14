import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { content, type } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
      return NextResponse.json(
        { error: "IPFS service not configured" },
        { status: 503 },
      );
    }

    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent: content,
        pinataMetadata: {
          name: `prester-${type}-${Date.now()}`,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Pinata error:", err);
      return NextResponse.json(
        { error: "IPFS upload failed" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { IpfsHash: string };
    return NextResponse.json({ uri: `ipfs://${data.IpfsHash}` });
  } catch (error) {
    console.error("IPFS upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload to IPFS" },
      { status: 500 },
    );
  }
}
