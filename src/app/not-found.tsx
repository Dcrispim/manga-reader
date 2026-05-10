import { redirect } from "next/navigation";

export default function NotFound() {
  // Redirect to homepage
  redirect("/");
}