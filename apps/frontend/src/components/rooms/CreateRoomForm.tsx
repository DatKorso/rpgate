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
import { type CreateRoomInput, createRoomSchema } from "@rpgate/shared/schemas";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";

/**
 * Room creation form component
 * Handles room creation with client-side validation
 */

interface FormErrors {
  name?: string[];
  description?: string[];
  general?: string;
}

export function CreateRoomForm() {
  const router = useRouter();
  const { createRoom, loading, error, clearError } = useRoom(null);

  const [formData, setFormData] = useState<CreateRoomInput>({
    name: "",
    description: "",
    isPrivate: false,
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate form data using Zod schema
   */
  const validateForm = (): boolean => {
    const result = createRoomSchema.safeParse(formData);

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

      // Clear field-specific errors when user starts typing
      if (formErrors[field as keyof FormErrors]) {
        setFormErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }

      // Clear general errors
      if (error) {
        clearError();
      }
    };

  /**
   * Handle privacy toggle
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
      const newRoom = await createRoom(formData);

      if (newRoom) {
        // Room created successfully, redirect to room page
        router.push(`/rooms/${newRoom.id}`);
      } else {
        setFormErrors((prev) => ({
          ...prev,
          general: error || "Ошибка создания комнаты. Попробуйте снова.",
        }));
      }
    } catch (_createError) {
      setFormErrors((prev) => ({
        ...prev,
        general: error || "Ошибка создания комнаты. Попробуйте снова.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    router.push("/rooms");
  };

  const isFormDisabled = loading || isSubmitting;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Создать новую комнату</CardTitle>
        <CardDescription>
          Создайте комнату для своей RPG-сессии. Вы станете её владельцем.
        </CardDescription>
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
            <p className="text-xs text-muted-foreground">Максимум 100 символов</p>
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
            <p className="text-xs text-muted-foreground">Максимум 500 символов</p>
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
                <SelectValue placeholder="Выберите тип комнаты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Публичная - любой может присоединиться</SelectItem>
                <SelectItem value="private">Приватная - только по приглашению</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.isPrivate
                ? "Только пользователи с ссылкой-приглашением смогут присоединиться"
                : "Комната будет видна всем пользователям"}
            </p>
          </div>

          {/* General Error Display */}
          {(error || formErrors.general) && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error || formErrors.general}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isFormDisabled}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isFormDisabled}>
              {isSubmitting ? "Создание..." : "Создать комнату"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
