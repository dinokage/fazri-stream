import React from 'react'
import { getServerSession } from 'next-auth';
import { OPTIONS } from "@/auth.config";
import { redirect } from 'next/navigation';

const page = async () => {
    const session = await getServerSession(OPTIONS);

    if (!session || !session.user) {
        redirect("/auth");
    }
    redirect("/dashboard");
}

export default page