'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginSchema, type LoginInput } from '@rpgate/shared';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * User login form component
 * Handles user authentication with client-side validation and error handling
 */

interface FormErrors {
  username?: string[];
  password?: string[];
  general?: string;
}

export function LoginForm() {
  const router = useRouter();
  const { login, loading, error, clearError } = useAuth();
  
  const [formData, setFormData] = useState<LoginInput>({
    username: '',
    password: '',
  });
  
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate form data using Zod schema
   */
  const validateForm = (): boolean => {
    const result = loginSchema.safeParse(formData);
    
    if (!result.success) {
      const errors: FormErrors = {};
      
      result.error.errors.forEach((error) => {
        const field = error.path[0] as keyof FormErrors;
        if (field && field !== 'general') {
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field]!.push(error.message);
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
  const handleInputChange = (field: keyof LoginInput) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear field-specific errors when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
    
    // Clear general auth errors
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
      await login(formData);
      
      // Login successful, redirect to main app
      router.push('/');
    } catch (loginError) {
      // Error is handled by auth context and displayed via error state
      setFormErrors(prev => ({
        ...prev,
        general: error || 'Ошибка входа. Проверьте правильность данных.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormDisabled = loading || isSubmitting;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Добро пожаловать!</CardTitle>
        <CardDescription>
          Войдите в свой аккаунт RPGate, чтобы продолжить приключения
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Field */}
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Имя пользователя
            </label>
            <Input
              id="username"
              type="text"
              placeholder="Введите имя пользователя"
              value={formData.username}
              onChange={handleInputChange('username')}
              disabled={isFormDisabled}
              className={formErrors.username ? 'border-destructive' : ''}
              autoComplete="username"
            />
            {formErrors.username && (
              <div className="text-sm text-destructive">
                {formErrors.username.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Пароль
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Введите пароль"
              value={formData.password}
              onChange={handleInputChange('password')}
              disabled={isFormDisabled}
              className={formErrors.password ? 'border-destructive' : ''}
              autoComplete="current-password"
            />
            {formErrors.password && (
              <div className="text-sm text-destructive">
                {formErrors.password.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            )}
          </div>

          {/* General Error Display */}
          {(error || formErrors.general) && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error || formErrors.general}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isFormDisabled}
          >
            {isSubmitting ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}