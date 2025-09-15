import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OrderClient from "./OrderClient";

export default async function OrderPage() {
    const cookieStore = await cookies();
    const auth = cookieStore.get("auth")?.value;
    if (!auth) {
        redirect("/login?from=/order");
    }
    return <OrderClient />;
}
