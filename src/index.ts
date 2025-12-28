export interface Env {
  TOKYO_METRO_API_KEY: string;
}

/**
 * 東京メトロ TrainInformation（必要最小限）
 */
type TrainInformation = {
  "odpt:trainInformationStatus"?: {
    ja?: string;
  };
  "odpt:trainInformationText"?: {
    ja?: string;
  };
  "dc:date"?: string;
};

/**
 * APIレスポンス（配列）
 */
type TrainInformationResponse = TrainInformation[];

/**
 * キャッシュ秒数
 */
const CACHE_TTL = 30;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cache = caches.default;
    const cacheKey = new Request(request.url, request);

    // ---------- ① Edge Cache ----------
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    // ---------- ② 東京メトロAPI呼び出し ----------
    const apiUrl =
      "https://api.odpt.org/api/v4/odpt:TrainInformation" +
      "?odpt:railway=odpt.Railway:TokyoMetro.Chiyoda" +
      "&acl:consumerKey=" +
      env.TOKYO_METRO_API_KEY;

    const apiRes = await fetch(apiUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "kitaayase-worker/1.0",
      },
    });

    if (!apiRes.ok) {
      const body = await apiRes.text();
      return new Response(
        JSON.stringify(
          {
            error: "Tokyo Metro API error",
            status: apiRes.status,
            body,
          },
          null,
          2
        ),
        { status: 500 }
      );
    }

    // ---------- ③ JSON parse + 型付け ----------
    const data = (await apiRes.json()) as unknown;

    const list: TrainInformationResponse =
      Array.isArray(data) ? (data as TrainInformationResponse) : [];

    const info: TrainInformation | null =
      list.length > 0 ? list[0] : null;

    // ---------- ④ 正規化 ----------
    const statusJa = info?.["odpt:trainInformationStatus"]?.ja ?? "";
    const textJa = info?.["odpt:trainInformationText"]?.ja ?? "";
    const updatedAt =
      info?.["dc:date"] ?? new Date().toISOString();

    const state: "normal" | "delay" | "suspended" =
      statusJa.includes("平常")
        ? "normal"
        : statusJa.includes("見合わせ")
        ? "suspended"
        : "delay";

    const payload = {
      railway: "chiyoda",
      state,
      text:
        textJa || "現在、平常どおり運転しています。",
      updatedAt,
    };

    // ---------- ⑤ レスポンス生成 ----------
    const response = new Response(
      JSON.stringify(payload, null, 2),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": `public, max-age=${CACHE_TTL}`,
        },
      }
    );

    // ---------- ⑥ Edge Cache 保存 ----------
    await cache.put(cacheKey, response.clone());

    return response;
  },
};
