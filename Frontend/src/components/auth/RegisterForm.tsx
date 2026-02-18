import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoginTypeSelector } from '@/components/ui/LoginTypeSelector';
import { UserType } from '@/types/auth';
import { registrationSchema, RegistrationFormData } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth';

export const RegisterForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typeParam = searchParams.get('type');
  const requestedUserType: UserType =
    typeParam === 'official'
      ? 'official'
      : typeParam === 'head_supervisor'
        ? 'head_supervisor'
        : 'local';

  const [userType, setUserType] = useState<UserType>(requestedUserType);

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: 'onBlur',
    defaultValues: {
      userType: requestedUserType,
    },
  });

  const { setValue } = form;

  useEffect(() => {
    setUserType(requestedUserType);
    setValue('userType', requestedUserType);
  }, [requestedUserType, setValue]);

  const password = form.watch('password', '');
  
  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const handleSubmit = async (data: RegistrationFormData) => {
    setIsSubmitting(true);
    
    // Correctly map the user type to backend expected values
    let backendUserType = data.userType;
    if (data.userType === 'local') {
        backendUserType = 'citizen';
    }

    try {
      const response = await authService.register({
        name: data.fullName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        userType: backendUserType,
        address: data.address,
        pincode: data.pincode,
      });

      if (response.success) {
        toast({
          title: "Registration Successful!",
          description: "Your account has been created successfully.",
        });

        setTimeout(() => {
          const userType = response.data?.user.userType;
          if (userType === 'head_supervisor') {
            navigate('/official/supervisor/dashboard');
            return;
          }
          if (userType === 'official') {
            navigate('/official/dashboard');
            return;
          }
          navigate('/dashboard');
        }, 1000);
      } else {
        toast({
          title: "Registration Failed",
          description: response.error || "An error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: "Unable to connect to server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto animate-fade-in">
      <div className="bg-card rounded-2xl shadow-card p-8 border border-border">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
            Create Account
          </h1>
          <p className="text-muted-foreground">
            Join SafeLive to report and track incidents
          </p>
        </div>

        {/* User Type Selector */}
        <div className="mb-6">
          <Label className="text-sm font-medium text-muted-foreground mb-3 block">
            Select Account Type
          </Label>
          <LoginTypeSelector
            selectedType={userType}
            onSelectType={(type) => {
              setUserType(type);
              form.setValue('userType', type);
            }}
          />
        </div>

        {/* Form */}
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              autoComplete="name"
              {...form.register('fullName')}
              className={cn(
                form.formState.errors.fullName && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {form.formState.errors.fullName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>

          {/* Email & Phone Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...form.register('email')}
                className={cn(
                  form.formState.errors.email && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 bg-muted border border-input rounded-md text-sm text-muted-foreground">
                  +91
                </div>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  autoComplete="tel"
                  {...form.register('phone')}
                  className={cn(
                    "flex-1",
                    form.formState.errors.phone && "border-destructive focus-visible:ring-destructive"
                  )}
                />
              </div>
              {form.formState.errors.phone && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              placeholder="Enter your complete address"
              rows={3}
              {...form.register('address')}
              className={cn(
                "resize-none",
                form.formState.errors.address && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {form.formState.errors.address && (
              <p className="text-sm text-destructive">
                {form.formState.errors.address.message}
              </p>
            )}
          </div>

          {/* Pincode */}
          <div className="space-y-2">
            <Label htmlFor="pincode">Pincode</Label>
            <Input
              id="pincode"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
              {...form.register('pincode')}
              className={cn(
                "w-32",
                form.formState.errors.pincode && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {form.formState.errors.pincode && (
              <p className="text-sm text-destructive">
                {form.formState.errors.pincode.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                autoComplete="new-password"
                {...form.register('password')}
                className={cn(
                  "pr-10",
                  form.formState.errors.password && "border-destructive focus-visible:ring-destructive"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {/* Password Requirements */}
            {password && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <CheckCircle2 
                      className={cn(
                        "h-3.5 w-3.5 transition-colors",
                        req.met ? "text-success" : "text-muted-foreground/40"
                      )} 
                    />
                    <span className={cn(
                      "text-xs transition-colors",
                      req.met ? "text-success" : "text-muted-foreground"
                    )}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                autoComplete="new-password"
                {...form.register('confirmPassword')}
                className={cn(
                  "pr-10",
                  form.formState.errors.confirmPassword && "border-destructive focus-visible:ring-destructive"
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Creating Account...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Create Account
              </div>
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="text-primary font-medium hover:text-primary/80 transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};








// import { useEffect, useState } from 'react';
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import { Link, useNavigate, useSearchParams } from 'react-router-dom';
// import { Eye, EyeOff, UserPlus, CheckCircle2 } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
// import { LoginTypeSelector } from '@/components/ui/LoginTypeSelector';
// import { UserType } from '@/types/auth';
// import { registrationSchema, RegistrationFormData } from '@/lib/validation';
// import { cn } from '@/lib/utils';
// import { useToast } from '@/hooks/use-toast';
// import { authService } from '@/services/auth';

// export const RegisterForm = () => {
//   const navigate = useNavigate();
//   const [searchParams] = useSearchParams();
//   const { toast } = useToast();
//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const requestedUserType: UserType =
//     searchParams.get('type') === 'official' ? 'official' : 'local';

//   const [userType, setUserType] = useState<UserType>(requestedUserType);

//   const form = useForm<RegistrationFormData>({
//     resolver: zodResolver(registrationSchema),
//     mode: 'onBlur',
//     defaultValues: {
//       userType: requestedUserType,
//     },
//   });

//   const { setValue } = form;

//   useEffect(() => {
//     setUserType(requestedUserType);
//     setValue('userType', requestedUserType);
//   }, [requestedUserType, setValue]);

//   const password = form.watch('password', '');
  
//   const passwordRequirements = [
//     { label: 'At least 8 characters', met: password.length >= 8 },
//     { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
//     { label: 'One lowercase letter', met: /[a-z]/.test(password) },
//     { label: 'One number', met: /[0-9]/.test(password) },
//     { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
//   ];

//   const handleSubmit = async (data: RegistrationFormData) => {
//     setIsSubmitting(true);
    
//     try {
//       const response = await authService.register({
//         name: data.fullName,
//         email: data.email,
//         phone: data.phone,
//         password: data.password,
//         userType: data.userType === 'local' ? 'citizen' : 'official',
//         address: data.address,
//         pincode: data.pincode,
//       });

//       if (response.success) {
//         toast({
//           title: "Registration Successful!",
//           description: "Your account has been created successfully.",
//         });

//         setTimeout(() => {
//           if (response.data?.user.userType === 'official') {
//             navigate('/official/dashboard');
//           } else {
//             navigate('/dashboard');
//           }
//         }, 1000);
//       } else {
//         toast({
//           title: "Registration Failed",
//           description: response.error || "An error occurred. Please try again.",
//           variant: "destructive",
//         });
//       }
//     } catch (error) {
//       toast({
//         title: "Registration Failed",
//         description: "Unable to connect to server. Please try again.",
//         variant: "destructive",
//       });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="w-full max-w-lg mx-auto animate-fade-in">
//       <div className="bg-card rounded-2xl shadow-card p-8 border border-border">
//         {}
//         <div className="text-center mb-8">
//           <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
//             Create Account
//           </h1>
//           <p className="text-muted-foreground">
//             Join SafeLive to report and track incidents
//           </p>
//         </div>

//         {}
//         <div className="mb-6">
//           <Label className="text-sm font-medium text-muted-foreground mb-3 block">
//             Select Account Type
//           </Label>
//           <LoginTypeSelector
//             selectedType={userType}
//             onSelectType={(type) => {
//               setUserType(type);
//               form.setValue('userType', type);
//             }}
//           />
//         </div>

//         {}
//         <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
//           {}
//           <div className="space-y-2">
//             <Label htmlFor="fullName">Full Name</Label>
//             <Input
//               id="fullName"
//               placeholder="John Doe"
//               autoComplete="name"
//               {...form.register('fullName')}
//               className={cn(
//                 form.formState.errors.fullName && "border-destructive focus-visible:ring-destructive"
//               )}
//             />
//             {form.formState.errors.fullName && (
//               <p className="text-sm text-destructive">
//                 {form.formState.errors.fullName.message}
//               </p>
//             )}
//           </div>

//           {}
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <div className="space-y-2">
//               <Label htmlFor="email">Email Address</Label>
//               <Input
//                 id="email"
//                 type="email"
//                 placeholder="you@example.com"
//                 autoComplete="email"
//                 {...form.register('email')}
//                 className={cn(
//                   form.formState.errors.email && "border-destructive focus-visible:ring-destructive"
//                 )}
//               />
//               {form.formState.errors.email && (
//                 <p className="text-sm text-destructive">
//                   {form.formState.errors.email.message}
//                 </p>
//               )}
//             </div>

//             <div className="space-y-2">
//               <Label htmlFor="phone">Phone Number</Label>
//               <div className="flex gap-2">
//                 <div className="flex items-center px-3 bg-muted border border-input rounded-md text-sm text-muted-foreground">
//                   +91
//                 </div>
//                 <Input
//                   id="phone"
//                   type="tel"
//                   placeholder="9876543210"
//                   autoComplete="tel"
//                   {...form.register('phone')}
//                   className={cn(
//                     "flex-1",
//                     form.formState.errors.phone && "border-destructive focus-visible:ring-destructive"
//                   )}
//                 />
//               </div>
//               {form.formState.errors.phone && (
//                 <p className="text-sm text-destructive">
//                   {form.formState.errors.phone.message}
//                 </p>
//               )}
//             </div>
//           </div>

//           {}
//           <div className="space-y-2">
//             <Label htmlFor="address">Address</Label>
//             <Textarea
//               id="address"
//               placeholder="Enter your complete address"
//               rows={3}
//               {...form.register('address')}
//               className={cn(
//                 "resize-none",
//                 form.formState.errors.address && "border-destructive focus-visible:ring-destructive"
//               )}
//             />
//             {form.formState.errors.address && (
//               <p className="text-sm text-destructive">
//                 {form.formState.errors.address.message}
//               </p>
//             )}
//           </div>

//           {}
//           <div className="space-y-2">
//             <Label htmlFor="pincode">Pincode</Label>
//             <Input
//               id="pincode"
//               type="text"
//               inputMode="numeric"
//               placeholder="123456"
//               maxLength={6}
//               {...form.register('pincode')}
//               className={cn(
//                 "w-32",
//                 form.formState.errors.pincode && "border-destructive focus-visible:ring-destructive"
//               )}
//             />
//             {form.formState.errors.pincode && (
//               <p className="text-sm text-destructive">
//                 {form.formState.errors.pincode.message}
//               </p>
//             )}
//           </div>

//           {}
//           <div className="space-y-2">
//             <Label htmlFor="password">Password</Label>
//             <div className="relative">
//               <Input
//                 id="password"
//                 type={showPassword ? "text" : "password"}
//                 placeholder="Create a strong password"
//                 autoComplete="new-password"
//                 {...form.register('password')}
//                 className={cn(
//                   "pr-10",
//                   form.formState.errors.password && "border-destructive focus-visible:ring-destructive"
//                 )}
//               />
//               <button
//                 type="button"
//                 onClick={() => setShowPassword(!showPassword)}
//                 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
//               >
//                 {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
//               </button>
//             </div>
            
//             {}
//             {password && (
//               <div className="grid grid-cols-2 gap-2 mt-2">
//                 {passwordRequirements.map((req, index) => (
//                   <div key={index} className="flex items-center gap-1.5">
//                     <CheckCircle2 
//                       className={cn(
//                         "h-3.5 w-3.5 transition-colors",
//                         req.met ? "text-success" : "text-muted-foreground/40"
//                       )} 
//                     />
//                     <span className={cn(
//                       "text-xs transition-colors",
//                       req.met ? "text-success" : "text-muted-foreground"
//                     )}>
//                       {req.label}
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           {}
//           <div className="space-y-2">
//             <Label htmlFor="confirmPassword">Confirm Password</Label>
//             <div className="relative">
//               <Input
//                 id="confirmPassword"
//                 type={showConfirmPassword ? "text" : "password"}
//                 placeholder="Confirm your password"
//                 autoComplete="new-password"
//                 {...form.register('confirmPassword')}
//                 className={cn(
//                   "pr-10",
//                   form.formState.errors.confirmPassword && "border-destructive focus-visible:ring-destructive"
//                 )}
//               />
//               <button
//                 type="button"
//                 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
//                 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
//               >
//                 {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
//               </button>
//             </div>
//             {form.formState.errors.confirmPassword && (
//               <p className="text-sm text-destructive">
//                 {form.formState.errors.confirmPassword.message}
//               </p>
//             )}
//           </div>

//           {}
//           <Button
//             type="submit"
//             className="w-full gradient-primary hover:opacity-90 transition-opacity"
//             size="lg"
//             disabled={isSubmitting}
//           >
//             {isSubmitting ? (
//               <div className="flex items-center gap-2">
//                 <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
//                 Creating Account...
//               </div>
//             ) : (
//               <div className="flex items-center gap-2">
//                 <UserPlus className="h-4 w-4" />
//                 Create Account
//               </div>
//             )}
//           </Button>
//         </form>

//         {}
//         <div className="mt-6 text-center">
//           <p className="text-muted-foreground">
//             Already have an account?{' '}
//             <Link 
//               to="/login" 
//               className="text-primary font-medium hover:text-primary/80 transition-colors"
//             >
//               Sign In
//             </Link>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };
