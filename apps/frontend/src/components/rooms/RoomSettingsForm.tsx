"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRoom } from "@/hooks/use-rooms";
import { type UpdateRoomInput, updateRoomSchema } from "@rpgate/shared/schemas";
import { Copy, Link as LinkIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

/**
 * Room settings form component
 * Handles room updates, member management, and invite link generation
 */

interface RoomSettingsFormProps {
  roomId: string;
}

interface FormErrors {
  name?: string[];
  description?: string[];
  general?: string;
}

export function RoomSettingsForm({ roomId }: RoomSettingsFormProps) {
  const router = useRouter();
  const { room, loading, error, updateRoom, deleteRoom, generateInviteLink, clearError } =
    useRoom(roomId);

  const [formData, setFormData] = useState<UpdateRoomInput>({
    name: "",
    description: "",
    isPrivate: false,
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  /**
   * Initialize form with room data
   */
  useEffect(() => {
    if (room) {
      setFormData({
        name: room.name,
        description: room.description,
        isPrivate: room.isPrivate,
      });
    }
  }, [room]);

  /**
   * Validate form data using Zod schema
   */
  const validateForm = (): boolean => {
    const result = updateRoomSchema.safeParse(formData);

    if (!result.success) {
      const errors: FormErrors = {};

      result.error.errors.forEach((error) => {
        const field = error.path[0] as keyof FormErrors;
        if (field && field !== "general") {
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field]?.push(error.message);
        }
      });

      setFormErrors(errors);
      return false;
    }

    setFormErrors({});
    return true;
  };

  /**
   * Handle input field changes
   */
  const handleInputChange =
    (field: keyof typeof formData) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;

      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear field-specific errors
      if (formErrors[field as keyof FormErrors]) {
        setFormErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }

      if (error) {
        clearError();
      }
    };

  /**
   * Handle privacy change
   */
  const handlePrivacyChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      isPrivate: value === "private",
    }));

    if (error) {
      clearError();
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      const success = await updateRoom(formData);

      if (success) {
        // Show success message or redirect
        alert("Комната успешно обновлена!");
      } else {
        setFormErrors((prev) => ({
          ...prev,
          general: error || "Ошибка обновления комнаты. Попробуйте снова.",
        }));
      }
    } catch (_updateError) {
      setFormErrors((prev) => ({
        ...prev,
        general: error || "Ошибка обновления комнаты. Попробуйте снова.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle room deletion
   */
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const success = await deleteRoom();

      if (success) {
        router.push("/rooms");
      } else {
        alert(error || "Ошибка удаления комнаты");
      }
    } catch (_deleteError) {
      alert(error || "Ошибка удаления комнаты");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  /**
   * Generate invite link
   */
  const handleGenerateInvite = async () => {
    try {
      setIsGeneratingInvite(true);
      const invite = await generateInviteLink({ expiresIn: 86400 }); // 24 hours

      if (invite) {
        setInviteLink(invite.url);
      }
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  /**
   * Copy invite link to clipboard
   */
  const handleCopyInvite = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy invite link:", err);
      }
    }
  };

  if (loading && !room) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Загрузка настроек комнаты...</p>
        </CardContent>
      </Card>
    );
  }

  if (!room) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-8">
          <p className="text-center text-destructive">Комната не найдена</p>
        </CardContent>
      </Card>
    );
  }

  const isFormDisabled = loading || isSubmitting || isDeleting;

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      {/* Room Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle>Настройки комнаты</CardTitle>
          <CardDescription>Управляйте настройками вашей комнаты</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Room Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Название комнаты *</Label>
              <Input
                id="name"
                type="text"
                placeholder="Введите название комнаты"
                value={formData.name}
                onChange={handleInputChange("name")}
                disabled={isFormDisabled}
                className={formErrors.name ? "border-destructive" : ""}
                maxLength={100}
              />
              {formErrors.name && (
                <div className="text-sm text-destructive">
                  {formErrors.name.map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Room Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                placeholder="Опишите вашу игровую сессию..."
                value={formData.description}
                onChange={handleInputChange("description")}
                disabled={isFormDisabled}
                className={formErrors.description ? "border-destructive" : ""}
                maxLength={500}
                rows={4}
              />
              {formErrors.description && (
                <div className="text-sm text-destructive">
                  {formErrors.description.map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Privacy Setting */}
            <div className="space-y-2">
              <Label htmlFor="privacy">Приватность</Label>
              <Select
                value={formData.isPrivate ? "private" : "public"}
                onValueChange={handlePrivacyChange}
                disabled={isFormDisabled}
              >
                <SelectTrigger id="privacy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Публичная - любой может присоединиться</SelectItem>
                  <SelectItem value="private">Приватная - только по приглашению</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* General Error Display */}
            {(error || formErrors.general) && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error || formErrors.general}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isFormDisabled}>
                {isSubmitting ? "Сохранение..." : "Сохранить изменения"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/rooms/${roomId}`)}
                disabled={isFormDisabled}
              >
                Отмена
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Invite Link Section */}
      <Card>
        <CardHeader>
          <CardTitle>Пригласительная ссылка</CardTitle>
          <CardDescription>Создайте ссылку для приглашения новых участников</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {inviteLink ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input value={inviteLink} readOnly className="flex-1" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopyInvite}
                  title="Скопировать ссылку"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {inviteCopied && <p className="text-sm text-green-600">Ссылка скопирована!</p>}
              <p className="text-xs text-muted-foreground">
                Эта ссылка действительна в течение 24 часов
              </p>
            </div>
          ) : (
            <Button onClick={handleGenerateInvite} disabled={isGeneratingInvite} variant="outline">
              <LinkIcon className="h-4 w-4 mr-2" />
              {isGeneratingInvite ? "Генерация..." : "Создать ссылку-приглашение"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Опасная зона</CardTitle>
          <CardDescription>Необратимые действия с комнатой</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isFormDisabled}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить комнату
            </Button>
          ) : (
            <div className="space-y-3 p-4 bg-destructive/10 rounded-md">
              <p className="font-medium">Вы уверены, что хотите удалить эту комнату?</p>
              <p className="text-sm text-muted-foreground">
                Это действие нельзя отменить. Все сообщения и данные комнаты будут удалены.
              </p>
              <div className="flex items-center gap-3">
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? "Удаление..." : "Да, удалить комнату"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
