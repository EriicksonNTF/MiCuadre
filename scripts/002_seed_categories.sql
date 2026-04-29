-- MiCuadre Default Categories
-- These are system-wide default categories available to all users

-- Expense Categories
INSERT INTO public.categories (id, user_id, name, icon, color, type, is_default) VALUES
  (uuid_generate_v4(), NULL, 'Comida', 'utensils', '#ef4444', 'expense', true),
  (uuid_generate_v4(), NULL, 'Transporte', 'car', '#f97316', 'expense', true),
  (uuid_generate_v4(), NULL, 'Entretenimiento', 'gamepad-2', '#8b5cf6', 'expense', true),
  (uuid_generate_v4(), NULL, 'Compras', 'shopping-bag', '#ec4899', 'expense', true),
  (uuid_generate_v4(), NULL, 'Servicios', 'zap', '#eab308', 'expense', true),
  (uuid_generate_v4(), NULL, 'Salud', 'heart-pulse', '#22c55e', 'expense', true),
  (uuid_generate_v4(), NULL, 'Educacion', 'graduation-cap', '#3b82f6', 'expense', true),
  (uuid_generate_v4(), NULL, 'Hogar', 'home', '#14b8a6', 'expense', true),
  (uuid_generate_v4(), NULL, 'Supermercado', 'shopping-cart', '#f59e0b', 'expense', true),
  (uuid_generate_v4(), NULL, 'Suscripciones', 'credit-card', '#6366f1', 'expense', true),
  (uuid_generate_v4(), NULL, 'Otros Gastos', 'circle-dot', '#64748b', 'expense', true)
ON CONFLICT DO NOTHING;

-- Income Categories
INSERT INTO public.categories (id, user_id, name, icon, color, type, is_default) VALUES
  (uuid_generate_v4(), NULL, 'Salario', 'briefcase', '#22c55e', 'income', true),
  (uuid_generate_v4(), NULL, 'Freelance', 'laptop', '#10b981', 'income', true),
  (uuid_generate_v4(), NULL, 'Inversiones', 'trending-up', '#059669', 'income', true),
  (uuid_generate_v4(), NULL, 'Regalos', 'gift', '#14b8a6', 'income', true),
  (uuid_generate_v4(), NULL, 'Reembolsos', 'rotate-ccw', '#0ea5e9', 'income', true),
  (uuid_generate_v4(), NULL, 'Otros Ingresos', 'plus-circle', '#64748b', 'income', true)
ON CONFLICT DO NOTHING;
