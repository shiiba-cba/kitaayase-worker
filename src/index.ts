export interface Env {
  TOKYO_METRO_API_KEY: string;
}

const CACHE_TTL = 30; // 秒

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cache = caches.default;

    // クエリも含めた URL を cache key にする
    const cacheKey = new Request(request.url, request);

    // --- ① キャッシュヒット確認 ---
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    // --- ② 東京メトロAPI呼び出し ---
    const url =
      "https://api.odpt.org/api/v4/odpt:TrainInformation" +
      "?odpt:railway=odpt.Railway:TokyoMetro.Chiyoda" +
      "&acl:consumerKey=" +
      env.TOKYO_METRO_API_KEY;

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "kitaayase-worker/1.0",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return new Response(
        JSON.stringify(
          { error: "Tokyo Metro API error", status: res.status, body },
          null,
          2
        ),
        { status: 500 }
      );
    }

    const json = await res.json();
    const info = json[0];

    // --- ③ 整形 ---
    const payload = info
      ? {
          railway: "chiyoda",
          state: info["odpt:trainInformationStatus"]?.ja?.includes("平常")
            ? "normal"
            : info["odpt:trainInformationStatus"]?.ja?.includes("見合わせ")
            ? "suspended"
            : "delay",
          text: info["odpt:trainInformationText"]?.ja ?? "",
          updatedAt: info["dc:date"] ?? new Date().toISOString(),
        }
      : {
          railway: "chiyoda",
          state: "normal",
          text: "現在、平常どおり運転しています。",
          updatedAt: new Date().toISOString(),
        };

    const response = new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": `public, max-age=${CACHE_TTL}`,
      },
    });

    // --- ④ エッジキャッシュに保存 ---
    await cache.put(cacheKey, response.clone());

    return response;
  },
};
