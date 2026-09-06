'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';

type PasswordInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  'type'
>;

/**
 * Password input with a trailing show/hide toggle.
 *
 * Defaults to `type="password"` for safety; click the eye icon to reveal.
 * Forwards all other props (placeholder, autoComplete, react-hook-form
 * `field` spread, etc.) to the underlying input so it slots into
 * `<FormControl>` exactly like `<Input type="password" />` would.
 */
export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <InputGroup>
      <InputGroupInput type={visible ? 'text' : 'password'} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
