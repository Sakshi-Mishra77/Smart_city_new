import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Building2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Captcha } from '@/components/ui/Captcha';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { authService, isAuthResponse, isOtpChallenge } from '@/services/auth';
import { UserType } from '@/types/auth';

interface OfficialLoginData {
  email: string;
  password: string;
  captcha: string;
}

export const OfficialLoginFormComponent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [captchaValue, setCaptchaValue] = useState('');
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [otpHint, setOtpHint] = useState('your email');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [loginRole, setLoginRole] = useState<UserType>('official');

  const describeChannels = (channels?: string[]) => {
    const set = new Set(channels || []);
    const hasEmail = set.has('email');
    const hasSms = set.has('sms');
    if (hasEmail && hasSms) return 'your email and phone';
    if (hasSms) return 'your phone';
    return 'your email';
  };

  const form = useForm<OfficialLoginData>({
    mode: 'onBlur',
  });

  const handleRedirect = (userType: string, fullName?: string, fallbackContact?: string) => {
    const displayName = fullName?.trim() || fallbackContact?.trim() || 'Official';
    toast({
      title: "Login Successful",
      description: `Welcome back, ${displayName}`
    });
    
    const destination = userType === 'head_supervisor'
      ? '/official/supervisor/dashboard'
      : '/official/dashboard';
    setTimeout(() => navigate(destination), 500);
  };

  const handleSubmit = async (data: OfficialLoginData) => {
    if (!isCaptchaValid) {
      toast({
        title: "Captcha Required",
        description: "Please solve the captcha correctly",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.login({
        email: data.email,
        password: data.password,
        expectedUserType: loginRole,
      });
      const result = response.data;
      if (response.success && isOtpChallenge(result) && result.requiresOtp) {
        setOtpChallengeId(result.challengeId);
        setOtpValue('');
        setOtpHint(describeChannels(result.channels));
        toast({
          title: "OTP Sent",
          description: `Enter the code sent to ${describeChannels(result.channels)} to finish signing in.`,
        });
        return;
      }
      
      const allowedRoles = ['official', 'head_supervisor'];
      if (response.success && isAuthResponse(result) && allowedRoles.includes(result.user.userType)) {
        handleRedirect(
          result.user.userType,
          result.user.fullName || result.user.name,
          result.user.email || result.user.phone
        );
      } else if (response.success) {
        toast({
          title: "Access Denied",
          description: "This portal is for officials only.",
          variant: "destructive",
        });
        await authService.logout();
      } else {
        toast({
          title: "Login Failed",
          description: response.error || "Invalid credentials",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpChallengeId) return;
    const trimmed = otpValue.trim();
    if (!trimmed) {
      toast({
        title: "OTP Required",
        description: "Enter the verification code.",
        variant: "destructive",
      });
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const response = await authService.verifyOtp(otpChallengeId, trimmed);
      const allowedRoles = ['official', 'head_supervisor'];
      if (response.success && response.data?.user && allowedRoles.includes(response.data.user.userType)) {
        handleRedirect(
          response.data.user.userType,
          response.data.user.fullName || response.data.user.name,
          response.data.user.email || response.data.user.phone
        );
        setOtpChallengeId(null);
        setOtpValue('');
        return;
      }
      if (response.success) {
        toast({
          title: "Access Denied",
          description: "Official account required",
          variant: "destructive",
        });
        await authService.logout();
        return;
      }
      toast({
        title: "Verification Failed",
        description: response.error || "Invalid code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      <div className="bg-card rounded-2xl shadow-card p-8 border border-border">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Official Login</h1>
          <p className="text-muted-foreground">Sign in to the administrative portal</p>
        </div>

        {/* Role Selector */}
        {!otpChallengeId && (
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setLoginRole('official')}
              className={cn(
                "flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all",
                loginRole === 'official' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building2 className="w-4 h-4" />
              Official
            </button>
            <button
              type="button"
              onClick={() => setLoginRole('head_supervisor')}
              className={cn(
                "flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all",
                loginRole === 'head_supervisor' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              Head Supervisor
            </button>
          </div>
        )}

        {otpChallengeId ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyOtp();
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A one-time code was sent to {otpHint}.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full gradient-accent hover:opacity-90 transition-opacity"
              size="lg"
              disabled={isVerifyingOtp}
            >
              {isVerifyingOtp ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                  Verifying...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Verify & Continue
                </div>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setOtpChallengeId(null);
                setOtpValue('');
              }}
              disabled={isVerifyingOtp}
            >
              Back to Login
            </Button>
          </form>
        ) : (
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{loginRole === 'head_supervisor' ? 'Supervisor Email' : 'Official Email'}</Label>
              <Input
                id="email"
                type="email"
                placeholder={loginRole === 'head_supervisor' ? "supervisor@safelive.in" : "official@safelive.in"}
                autoComplete="email"
                {...form.register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Invalid email address'
                  }
                })}
                className={cn(
                  form.formState.errors.email && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-sm text-primary hover:text-primary/80 transition-colors">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...form.register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Password must be at least 6 characters' }
                  })}
                  className={cn(
                    "pr-10",
                    form.formState.errors.password && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Security Check</Label>
              <Captcha
                value={captchaValue}
                onChange={(val) => {
                  setCaptchaValue(val);
                  form.setValue('captcha', val);
                }}
                onValidChange={setIsCaptchaValid}
              />
            </div>

            <Button
              type="submit"
              className="w-full gradient-accent hover:opacity-90 transition-opacity"
              size="lg"
              disabled={isSubmitting || !isCaptchaValid}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In as {loginRole === 'head_supervisor' ? 'Supervisor' : 'Official'}
                </div>
              )}
            </Button>
          </form>
        )}

        <div className="mt-6 space-y-4">
          <div className="text-center">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register?type=official" className="text-primary font-medium hover:text-primary/80 transition-colors">
                Register Here
              </Link>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              Local user?{' '}
              <Link to="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};






// import { useState } from 'react';
// import { useForm } from 'react-hook-form';
// import { Link, useNavigate } from 'react-router-dom';
// import { Eye, EyeOff, LogIn } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Captcha } from '@/components/ui/Captcha';
// import { cn } from '@/lib/utils';
// import { useToast } from '@/hooks/use-toast';
// import { authService, isAuthResponse, isOtpChallenge } from '@/services/auth';

// interface OfficialLoginData {
//   email: string;
//   password: string;
//   captcha: string;
// }

// export const OfficialLoginFormComponent = () => {
//   const navigate = useNavigate();
//   const { toast } = useToast();
//   const [showPassword, setShowPassword] = useState(false);
//   const [captchaValue, setCaptchaValue] = useState('');
//   const [isCaptchaValid, setIsCaptchaValid] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
//   const [otpValue, setOtpValue] = useState('');
//   const [otpHint, setOtpHint] = useState('your email');
//   const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

//   const describeChannels = (channels?: string[]) => {
//     const set = new Set(channels || []);
//     const hasEmail = set.has('email');
//     const hasSms = set.has('sms');
//     if (hasEmail && hasSms) return 'your email and phone';
//     if (hasSms) return 'your phone';
//     return 'your email';
//   };

//   const form = useForm<OfficialLoginData>({
//     mode: 'onBlur',
//   });

//   const handleSubmit = async (data: OfficialLoginData) => {
//     if (!isCaptchaValid) {
//       toast({
//         title: "Captcha Required",
//         description: "Please solve the captcha correctly",
//         variant: "destructive",
//       });
//       return;
//     }

//     setIsSubmitting(true);
//     try {
//       const response = await authService.login({
//         email: data.email,
//         password: data.password,
//         expectedUserType: 'official',
//       });
//       const result = response.data;
//       if (response.success && isOtpChallenge(result) && result.requiresOtp) {
//         setOtpChallengeId(result.challengeId);
//         setOtpValue('');
//         setOtpHint(describeChannels(result.channels));
//         toast({
//           title: "OTP Sent",
//           description: `Enter the code sent to ${describeChannels(result.channels)} to finish signing in.`,
//         });
//         return;
//       }
//       if (response.success && isAuthResponse(result) && result.user.userType === 'official') {
//         toast({
//           title: "Official Login Successful",
//           description: "Redirecting to official dashboard"
//         });
//         setTimeout(() => navigate('/official/dashboard'), 500);
//       } else if (response.success) {
//         toast({
//           title: "Access Denied",
//           description: "Official account required",
//           variant: "destructive",
//         });
//         await authService.logout();
//       } else {
//         toast({
//           title: "Login Failed",
//           description: response.error || "Invalid credentials",
//           variant: "destructive",
//         });
//       }
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleVerifyOtp = async () => {
//     if (!otpChallengeId) return;
//     const trimmed = otpValue.trim();
//     if (!trimmed) {
//       toast({
//         title: "OTP Required",
//         description: "Enter the verification code.",
//         variant: "destructive",
//       });
//       return;
//     }
//     setIsVerifyingOtp(true);
//     try {
//       const response = await authService.verifyOtp(otpChallengeId, trimmed);
//       if (response.success && response.data?.user.userType === 'official') {
//         toast({
//           title: "Verification Successful",
//           description: "Redirecting to official dashboard",
//         });
//         setOtpChallengeId(null);
//         setOtpValue('');
//         setTimeout(() => navigate('/official/dashboard'), 500);
//         return;
//       }
//       if (response.success) {
//         toast({
//           title: "Access Denied",
//           description: "Official account required",
//           variant: "destructive",
//         });
//         await authService.logout();
//         return;
//       }
//       toast({
//         title: "Verification Failed",
//         description: response.error || "Invalid code. Please try again.",
//         variant: "destructive",
//       });
//     } finally {
//       setIsVerifyingOtp(false);
//     }
//   };

//   return (
//     <div className="w-full max-w-md mx-auto animate-fade-in">
//       <div className="bg-card rounded-2xl shadow-card p-8 border border-border">
//         <div className="text-center mb-8">
//           <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Official Login</h1>
//           <p className="text-muted-foreground">Sign in as municipal or society admin</p>
//         </div>

//         {otpChallengeId ? (
//           <form
//             onSubmit={(e) => {
//               e.preventDefault();
//               handleVerifyOtp();
//             }}
//             className="space-y-5"
//           >
//             <div className="space-y-2">
//               <Label htmlFor="otp">Verification Code</Label>
//               <Input
//                 id="otp"
//                 inputMode="numeric"
//                 placeholder="Enter 6-digit code"
//                 value={otpValue}
//                 onChange={(e) => setOtpValue(e.target.value)}
//               />
//               <p className="text-xs text-muted-foreground">
//                 A one-time code was sent to {otpHint}.
//               </p>
//             </div>

//             <Button
//               type="submit"
//               className="w-full gradient-accent hover:opacity-90 transition-opacity"
//               size="lg"
//               disabled={isVerifyingOtp}
//             >
//               {isVerifyingOtp ? (
//                 <div className="flex items-center gap-2">
//                   <div className="h-4 w-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
//                   Verifying...
//                 </div>
//               ) : (
//                 <div className="flex items-center gap-2">
//                   <LogIn className="h-4 w-4" />
//                   Verify & Continue
//                 </div>
//               )}
//             </Button>

//             <Button
//               type="button"
//               variant="outline"
//               className="w-full"
//               onClick={() => {
//                 setOtpChallengeId(null);
//                 setOtpValue('');
//               }}
//               disabled={isVerifyingOtp}
//             >
//               Back to Login
//             </Button>
//           </form>
//         ) : (
//           <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
//           <div className="space-y-2">
//             <Label htmlFor="email">Official Email</Label>
//             <Input
//               id="email"
//               type="email"
//               placeholder="official@safelive.in"
//               autoComplete="email"
//               {...form.register('email', {
//                 required: 'Email is required',
//                 pattern: {
//                   value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
//                   message: 'Invalid email address'
//                 }
//               })}
//               className={cn(
//                 form.formState.errors.email && "border-destructive focus-visible:ring-destructive"
//               )}
//             />
//             {form.formState.errors.email && (
//               <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
//             )}
//           </div>

//           <div className="space-y-2">
//             <div className="flex items-center justify-between">
//               <Label htmlFor="password">Password</Label>
//               <Link to="/forgot-password" className="text-sm text-primary hover:text-primary/80 transition-colors">
//                 Forgot Password?
//               </Link>
//             </div>
//             <div className="relative">
//               <Input
//                 id="password"
//                 type={showPassword ? "text" : "password"}
//                 autoComplete="current-password"
//                 {...form.register('password', {
//                   required: 'Password is required',
//                   minLength: { value: 6, message: 'Password must be at least 6 characters' }
//                 })}
//                 className={cn(
//                   "pr-10",
//                   form.formState.errors.password && "border-destructive focus-visible:ring-destructive"
//                 )}
//               />
//               <button
//                 type="button"
//                 onClick={() => setShowPassword((v) => !v)}
//                 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
//               >
//                 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
//               </button>
//             </div>
//             {form.formState.errors.password && (
//               <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
//             )}
//           </div>

//           <div className="space-y-2">
//             <Label>Security Check</Label>
//             <Captcha
//               value={captchaValue}
//               onChange={(val) => {
//                 setCaptchaValue(val);
//                 form.setValue('captcha', val);
//               }}
//               onValidChange={setIsCaptchaValid}
//             />
//           </div>

//           <Button
//             type="submit"
//             className="w-full gradient-accent hover:opacity-90 transition-opacity"
//             size="lg"
//             disabled={isSubmitting || !isCaptchaValid}
//           >
//             {isSubmitting ? (
//               <div className="flex items-center gap-2">
//                 <div className="h-4 w-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
//                 Signing in...
//               </div>
//             ) : (
//               <div className="flex items-center gap-2">
//                 <LogIn className="h-4 w-4" />
//                 Sign In as Official
//               </div>
//             )}
//           </Button>
//           </form>
//         )}

//         <div className="mt-6 space-y-4">
//           <div className="text-center">
//             <p className="text-muted-foreground">
//               Don't have an account?{' '}
//               <Link to="/register" className="text-primary font-medium hover:text-primary/80 transition-colors">
//                 Register Here
//               </Link>
//             </p>
//             <p className="text-xs text-muted-foreground mt-1">
//               Choose "Official" during registration.
//             </p>
//           </div>

//           <div className="flex items-center gap-3">
//             <div className="flex-1 h-px bg-border" />
//             <span className="text-xs text-muted-foreground">OR</span>
//             <div className="flex-1 h-px bg-border" />
//           </div>

//           <div className="text-center">
//             <p className="text-muted-foreground text-sm">
//               Local user?{' '}
//               <Link to="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
//                 Login here
//               </Link>
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };
