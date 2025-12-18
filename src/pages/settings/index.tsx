import * as React from "react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { SettingsShell } from "@/components/settings/settings-shell";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";

const profileSchema = z.object({
  name: z.string().min(2, "Too short"),
  email: z.string().email("Invalid email"),
  username: z.string().min(2, "Too short"),
  avatar: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileSchema = z.infer<typeof profileSchema>;

export default function SettingsIndexPage() {
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = React.useState<string | undefined>(undefined);

  const form = useForm<ProfileSchema>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      avatar: undefined,
      bio: undefined,
    },
  });

  React.useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted || !user) return;

      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = (metadata.full_name as string | undefined) ?? (metadata.name as string | undefined);
      const username = (metadata.username as string | undefined) ?? user.email ?? "";
      const avatar = metadata.avatar_url as string | undefined;

      const values: ProfileSchema = {
        name: fullName ?? username,
        email: user.email ?? "",
        username,
        avatar,
        bio: undefined,
      };

      form.reset(values);
      setAvatarUrl(avatar);
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [form]);

  const onSubmit = (values: ProfileSchema) => {
    toast.success("Success", {
      description: "Your settings have been updated.",
    });
    // Keep parity with Vue (console.log of data)
    console.log(values);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAvatarUrl(url);
    form.setValue("avatar", url);
  };

  return (
    <SettingsShell>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-base font-semibold">Profile</div>
              <div className="text-sm text-muted-foreground">
                These informations will be displayed publicly.
              </div>
            </div>

            <Button type="submit" variant="secondary" className="w-fit sm:ml-auto">
              Save changes
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="sr-only">Profile</CardTitle>
              <CardDescription className="sr-only">Profile settings form</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <FormLabel>Name</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Will appear on receipts, invoices, and other communication.
                      </div>
                    </div>
                    <div className="w-full sm:max-w-sm">
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <FormLabel>Email</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Used to sign in, for email receipts and product updates.
                      </div>
                    </div>
                    <div className="w-full sm:max-w-sm">
                      <FormControl>
                        <Input type="email" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <FormLabel>Username</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Your unique username for logging in and your profile URL.
                      </div>
                    </div>
                    <div className="w-full sm:max-w-sm">
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="avatar"
                render={() => (
                  <FormItem className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <FormLabel>Avatar</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        JPG, GIF or PNG. 1MB Max.
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarImage src={avatarUrl} alt={form.getValues("name") ?? "Avatar"} />
                        <AvatarFallback>
                          {(form.getValues("name") ?? "?").slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => fileRef.current?.click()}
                      >
                        Choose
                      </Button>

                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.gif"
                        onChange={onFileChange}
                      />
                    </div>
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <FormLabel>Bio</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Brief description for your profile. URLs are hyperlinked.
                      </div>
                    </div>
                    <div className="w-full sm:max-w-sm">
                      <FormControl>
                        <Textarea rows={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </form>
      </Form>
    </SettingsShell>
  );
}
