"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Person, Envelope, Handset } from "@gravity-ui/icons";
import { toast, Spinner } from "@heroui/react";
import { authClient } from "@/lib/auth-client";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { name: "", phone: "" } });

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
    if (session?.user) {
      reset({ name: session.user.name || "", phone: session.user.phone || "" });
      setImagePreview(session.user.image || null);
    }
  }, [isPending, session, router, reset]);

  const handleImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.danger("Not an image", { description: "Please choose an image file." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.danger("Image too large", { description: "Please choose an image under 2MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
      setImageBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data) => {
    if (!data.phone || data.phone.trim() === "") {
      toast.danger("Phone number required", { description: "Please enter a phone number to continue." });
      return;
    }
    try {
      const { error } = await authClient.updateUser({
        name: data.name,
        phone: data.phone.trim(),
        ...(imageBase64 ? { image: imageBase64 } : {}),
      });
      if (error) {
        toast.danger("Couldn't save your profile", { description: error.message || "Please try again." });
        return;
      }
      router.push("/");
    } catch (error) {
      console.log(error);
      toast.danger("Couldn't save your profile", { description: "Something went wrong." });
    }
  };

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <p className="font-body-md text-body-md text-on-surface-variant">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-[2.5rem] bg-surface-container-low p-8 shadow-[12px_12px_28px_rgba(184,196,214,0.65),-12px_-12px_28px_rgba(255,255,255,0.95)]">
        <h1 className="font-headline-lg text-headline-lg text-on-surface text-center mb-1">
          Just one more step
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant text-center mb-6">
          We need a bit more info before you can start using Dispo.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-surface shadow-[inset_2px_2px_5px_rgba(184,196,214,0.5)]">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Person className="h-8 w-8 text-tertiary" />
                </div>
              )}
            </div>
            <label className="cursor-pointer rounded-full bg-surface px-4 py-2 font-label-md text-label-md text-on-surface-variant shadow-[3px_3px_8px_rgba(184,196,214,0.5)] hover:bg-surface-container-high transition-colors">
              {imagePreview ? "Change photo" : "Add a photo (optional)"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageFile(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="block font-label-md text-label-md text-on-surface font-semibold">Name</label>
            <div className="relative flex items-center rounded-full bg-surface px-4 py-3 shadow-[inset_3px_3px_6px_rgba(184,196,214,0.5)]">
              <Person className="text-tertiary w-4 h-4 mr-2.5 shrink-0" />
              <input
                type="text"
                className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none"
                {...register("name", { required: true })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-label-md text-label-md text-on-surface font-semibold">Phone number</label>
            <div className="relative flex items-center rounded-full bg-surface px-4 py-3 shadow-[inset_3px_3px_6px_rgba(184,196,214,0.5)]">
              <Handset className="text-tertiary w-4 h-4 mr-2.5 shrink-0" />
              <input
                type="tel"
                placeholder="01XXXXXXXXX"
                className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none"
                {...register("phone", { required: true })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-label-md text-label-md text-on-surface font-semibold">Email</label>
            <div className="relative flex items-center rounded-full bg-surface-container px-4 py-3">
              <Envelope className="text-tertiary w-4 h-4 mr-2.5 shrink-0" />
              <span className="font-body-md text-body-md text-on-surface-variant truncate">{session.user.email}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3.5 font-label-lg text-label-lg text-on-primary disabled:opacity-70 cursor-pointer"
          >
            {isSubmitting && <Spinner size="sm" color="current" />}
            {isSubmitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
