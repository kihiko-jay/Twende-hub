ALTER TYPE payment_status
  ADD VALUE IF NOT EXISTS 'manual_review_required';
