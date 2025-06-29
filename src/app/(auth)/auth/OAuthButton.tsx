"use client";

import React from "react";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { FcGoogle } from "react-icons/fc";

interface OAuthButtonsProps {
  isGoogleLoading: boolean;
  setIsGoogleLoading: (loading: boolean) => void;
}

export const OAuthButtons: React.FC<OAuthButtonsProps> = ({
  isGoogleLoading,
  setIsGoogleLoading,
}) => {
  const { toast } = useToast();
  const router = useRouter();

  // Function to handle Google sign-in
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const result = await signIn("google", { callbackUrl: "/profile", redirect: false });
    if (result?.error) {
      toast({
        title: "Google OAuth Error",
        description: "There was an issue signing in with Google. Please try again.",
        variant: "destructive",
      });
      setIsGoogleLoading(false);
    } else if (result?.url) {
      router.push(result.url);
    }
  };

  return (
    <div className="space-y-4">
      <motion.button
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading}
        className="backdrop-blur-[2px] w-full flex items-center justify-center gap-3 bg-foreground/5 hover:bg-foreground/10 text-foreground border border-border rounded-full py-3 px-4 transition-colors disabled:opacity-50"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        {!isGoogleLoading && <FcGoogle size={20} />}
        <span>{isGoogleLoading ? "Signing in..." : "Sign in with Google"}</span>
      </motion.button>
    </div>
  );
};