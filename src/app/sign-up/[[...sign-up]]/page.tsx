import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { LogoFull } from "@/components/branding/logo";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 p-6 bg-[radial-gradient(circle_at_20%_10%,rgba(30,215,96,0.12),transparent_45%),radial-gradient(circle_at_80%_90%,rgba(124,58,237,0.15),transparent_45%)]">
      <Link href="/">
        <LogoFull size={36} />
      </Link>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/" />
    </div>
  );
}
