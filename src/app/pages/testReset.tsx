// src/pages/TestReset.tsx
import { useState } from 'react';
import { requestPasswordReset, verifyPIN, resetPasswordWithPIN } from '../context/AuthContext';

export default function TestReset() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<any>(null);

  const testRequest = async () => {
    const res = await requestPasswordReset(email);
    setResult(res);
  };

  const testVerify = async () => {
    const res = await verifyPIN(email, pin);
    setResult(res);
  };

  const testReset = async () => {
    const res = await resetPasswordWithPIN(email, pin, password);
    setResult(res);
  };

  return (
    <div>
      <h1>Test Password Reset</h1>
      <div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <button onClick={testRequest}>Request PIN</button>
      </div>
      <div>
        <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" />
        <button onClick={testVerify}>Verify PIN</button>
      </div>
      <div>
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New Password" />
        <button onClick={testReset}>Reset Password</button>
      </div>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}