"use client";

import { useMemo, useState } from "react";

type OrderItem = {
    product_id: number;
    qty: number;
};

type OrderPayload = {
    order: {
        order_id: string;
        created_at: string;
        user: { user_id: number };
        cart: { items: OrderItem[] };
    };
};

function randInt(min: number, max: number) {
    // inclusive
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickNUnique(from: number, to: number, n: number): number[] {
    const size = to - from + 1;
    const count = Math.min(n, size);
    const pool: number[] = Array.from({ length: size }, (_, i) => from + i);
    // Fisher-Yates partial shuffle
    for (let i = 0; i < count; i++) {
        const j = i + Math.floor(Math.random() * (size - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

function generateOrderPayloads(numOrders: number): OrderPayload[] {
    // Unique user_id per order from 1..30
    const userIds = pickNUnique(1, 30, numOrders);
    const now = new Date().toISOString();
    const orders: OrderPayload[] = [];
    for (let i = 0; i < userIds.length; i++) {
        // Items 1..3 each
        const itemCount = randInt(1, 3);
        const productIds = pickNUnique(1, 100, itemCount);
        const items: OrderItem[] = productIds.map((pid) => ({
            product_id: pid,
            qty: randInt(1, 5),
        }));

        orders.push({
            order: {
                order_id: String(i + 1),
                created_at: now,
                user: { user_id: userIds[i] },
                cart: { items },
            },
        });
    }
    return orders;
}

export default function OrderClient() {
    const [count, setCount] = useState<number>(1);
    const [startOrderId, setStartOrderId] = useState<number>(1);
    const [lambdaUrl, setLambdaUrl] = useState<string>("https://example.com/order");
    const [generated, setGenerated] = useState<OrderPayload[] | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitLog, setSubmitLog] = useState<string[]>([]);
    const [editorText, setEditorText] = useState<string>("");
    const [editorError, setEditorError] = useState<string>("");

    const preview = useMemo(() => {
        if (!generated) return "";
        return JSON.stringify(generated, null, 2);
    }, [generated]);

    function handleGenerate() {
        const n = Math.max(1, Math.min(30, Number.isFinite(count) ? count : 1));
        const base = generateOrderPayloads(n);
        // apply starting order_id
        const adjusted = base.map((o, idx) => ({
            ...o,
            order: { ...o.order, order_id: String(startOrderId + idx) },
        }));
        setGenerated(adjusted);
        setEditorText(JSON.stringify(adjusted, null, 2));
        setEditorError("");
        setSubmitLog([]);
    }

    async function handleCopy() {
        if (!generated) return;
        try {
            await navigator.clipboard.writeText(preview);
            alert("คัดลอก JSON แล้ว");
        } catch {
            // ignore
        }
    }

    // Real POST helper with timeout using AbortController
    async function postWithTimeout(url: string, body: unknown, timeoutMs = 10000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            return res;
        } finally {
            clearTimeout(timer);
        }
    }

    function applyEditorChanges() {
        try {
            const parsed = JSON.parse(editorText);
            if (!Array.isArray(parsed)) {
                setEditorError("รูปแบบ JSON ต้องเป็น Array ของ orders");
                return;
            }
            // minimal shape check
            for (const it of parsed) {
                if (!it?.order || typeof it.order.order_id === "undefined") {
                    setEditorError("แต่ละรายการต้องมี field order และ order.order_id");
                    return;
                }
            }
            setGenerated(parsed as OrderPayload[]);
            setEditorError("");
            setSubmitLog([]);
            alert("อัปเดตจาก JSON แล้ว");
        } catch (e) {
            setEditorError("JSON ไม่ถูกต้อง: " + (e instanceof Error ? e.message : String(e)));
        }
    }

    async function handleSubmit() {
        // Prefer the currently edited JSON if valid
        let toSend: OrderPayload[] | null = generated;
        try {
            const parsed = JSON.parse(editorText);
            if (Array.isArray(parsed) && parsed.length > 0) {
                toSend = parsed as OrderPayload[];
            }
        } catch { /* ignore, fallback to generated */ }

        if (!toSend || toSend.length === 0) return;
        if (!lambdaUrl || !/^https?:\/\//i.test(lambdaUrl)) {
            alert("กรุณาระบุ URL ที่ถูกต้อง (ต้องขึ้นต้นด้วย http/https)");
            return;
        }
        setSubmitting(true);
        setSubmitLog([]);
        try {
            for (let i = 0; i < toSend.length; i++) {
                const payload = toSend[i];
                try {
                    // Call server proxy so the actual send happens on the server
                    const res = await postWithTimeout("/api/order", { url: lambdaUrl, payload }, 20000);
                    const reqId = res.headers.get("x-upstream-request-id") || "";
                    const text = await res.text();
                    const short = text.length > 200 ? text.slice(0, 200) + "..." : text;
                    setSubmitLog((logs) => [
                        ...logs,
                        res.ok
                            ? `ส่ง order_id=${payload.order.order_id} สำเร็จ (${res.status})${reqId ? ` [reqId:${reqId}]` : ""}`
                            : `ส่ง order_id=${payload.order.order_id} ล้มเหลว (${res.status})${reqId ? ` [reqId:${reqId}]` : ""} → ${short}`,
                    ]);
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.name : "unknown";
                    setSubmitLog((logs) => [
                        ...logs,
                        `ส่ง order_id=${payload.order.order_id} ล้มเหลว (network: ${msg})`,
                    ]);
                }
            }
            alert("ส่งคำสั่งซื้อเรียบร้อย (ผ่าน /api/order)");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
            <h1 className="text-2xl font-semibold">สร้างคำสั่งซื้อ (Mock)</h1>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <label className="block text-sm font-medium">จำนวนออเดอร์ (1-30)</label>
                    <input
                        type="number"
                        min={1}
                        max={30}
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium">เริ่ม order_id จาก</label>
                    <input
                        type="number"
                        min={-1_000_000_000}
                        max={1_000_000_000}
                        value={startOrderId}
                        onChange={(e) => setStartOrderId(Number(e.target.value))}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium">ปลายทาง (URL ที่จะส่งจากฝั่งเซิร์ฟเวอร์)</label>
                    <input
                        type="text"
                        value={lambdaUrl}
                        onChange={(e) => setLambdaUrl(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        placeholder="https://your-lambda-url/order"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleGenerate}
                    className="bg-black text-white rounded px-4 py-2"
                >
                    สร้างตัวอย่าง JSON
                </button>
            </div>

            {generated && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium">แก้ไข JSON ก่อนส่ง (แก้ไขได้)</label>
                    <textarea
                        value={editorText}
                        onChange={(e) => setEditorText(e.target.value)}
                        className="w-full border rounded p-3 font-mono text-sm h-64"
                        spellCheck={false}
                    />
                    {editorError && (
                        <div className="text-sm text-red-600">{editorError}</div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={applyEditorChanges} className="border rounded px-4 py-2">
                            นำไปใช้ (Apply JSON)
                        </button>
                        <button onClick={handleCopy} disabled={!generated} className="border rounded px-4 py-2 disabled:opacity-50">
                            คัดลอก JSON
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-2">
                <button
                    onClick={handleSubmit}
                    disabled={!generated || submitting}
                    className="bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
                >
                    ยืนยัน (ส่งผ่าน Server /api/order)
                </button>
                {submitting && <span className="text-sm text-gray-600">กำลังส่ง…</span>}
            </div>

            {submitLog.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-lg font-medium">ผลการส่ง</h2>
                    <ul className="list-disc pl-6 space-y-1">
                        {submitLog.map((line, idx) => (
                            <li key={idx} className="text-sm">{line}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
