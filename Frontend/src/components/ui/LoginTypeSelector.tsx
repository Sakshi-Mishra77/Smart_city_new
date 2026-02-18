import { UserType } from '@/types/auth';
import { Building2, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoginTypeSelectorProps {
  selectedType: UserType;
  onSelectType: (type: UserType) => void;
}

export const LoginTypeSelector = ({ selectedType, onSelectType }: LoginTypeSelectorProps) => {
  const isOfficialGroup = selectedType === 'official' || selectedType === 'head_supervisor';

  return (
    <div className="space-y-4">
      {/* Primary Selection: Local vs Official Group */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onSelectType('local')}
          className={cn(
            "relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-300",
            "hover:shadow-soft hover:-translate-y-0.5",
            selectedType === 'local'
              ? "border-primary bg-primary/5 shadow-glow"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <div className={cn(
            "p-3 rounded-full transition-colors duration-300",
            selectedType === 'local' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <User className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Local User</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Report incidents & track status
            </p>
          </div>
          {selectedType === 'local' && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectType('official')}
          className={cn(
            "relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-300",
            "hover:shadow-soft hover:-translate-y-0.5",
            isOfficialGroup
              ? "border-accent bg-accent/5 shadow-glow"
              : "border-border bg-card hover:border-accent/50"
          )}
        >
          <div className={cn(
            "p-3 rounded-full transition-colors duration-300",
            isOfficialGroup ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Building2 className="h-6 w-6" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Official User</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Admin & department access
            </p>
          </div>
          {isOfficialGroup && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-accent-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>
      </div>

      {/* Subgroup Selection: Official vs Head Supervisor */}
      {isOfficialGroup && (
        <div className="animate-fade-in grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => onSelectType('official')}
            className={cn(
              "flex items-center gap-2 p-3 rounded-md border transition-all text-sm",
              selectedType === 'official'
                ? "bg-background border-accent text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:bg-background/50"
            )}
          >
            <Building2 className={cn("h-4 w-4", selectedType === 'official' ? "text-accent" : "opacity-70")} />
            <span className="font-medium">Department Official</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectType('head_supervisor')}
            className={cn(
              "flex items-center gap-2 p-3 rounded-md border transition-all text-sm",
              selectedType === 'head_supervisor'
                ? "bg-background border-accent text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:bg-background/50"
            )}
          >
            <ShieldCheck className={cn("h-4 w-4", selectedType === 'head_supervisor' ? "text-accent" : "opacity-70")} />
            <span className="font-medium">Head Supervisor</span>
          </button>
        </div>
      )}
    </div>
  );
};







// import { UserType } from '@/types/auth';
// import { Building2, User } from 'lucide-react';
// import { cn } from '@/lib/utils';

// interface LoginTypeSelectorProps {
//   selectedType: UserType;
//   onSelectType: (type: UserType) => void;
// }

// export const LoginTypeSelector = ({ selectedType, onSelectType }: LoginTypeSelectorProps) => {
//   return (
//     <div className="grid grid-cols-2 gap-4">
//       <button
//         type="button"
//         onClick={() => onSelectType('local')}
//         className={cn(
//           "relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-300",
//           "hover:shadow-soft hover:-translate-y-0.5",
//           selectedType === 'local'
//             ? "border-primary bg-primary/5 shadow-glow"
//             : "border-border bg-card hover:border-primary/50"
//         )}
//       >
//         <div className={cn(
//           "p-3 rounded-full transition-colors duration-300",
//           selectedType === 'local' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
//         )}>
//           <User className="h-6 w-6" />
//         </div>
//         <div className="text-center">
//           <h3 className="font-semibold text-foreground">Local User</h3>
//           <p className="text-xs text-muted-foreground mt-1">
//             Report incidents & track status
//           </p>
//         </div>
//         {selectedType === 'local' && (
//           <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
//             <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
//               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
//             </svg>
//           </div>
//         )}
//       </button>

//       <button
//         type="button"
//         onClick={() => onSelectType('official')}
//         className={cn(
//           "relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-300",
//           "hover:shadow-soft hover:-translate-y-0.5",
//           selectedType === 'official'
//             ? "border-accent bg-accent/5 shadow-glow"
//             : "border-border bg-card hover:border-accent/50"
//         )}
//       >
//         <div className={cn(
//           "p-3 rounded-full transition-colors duration-300",
//           selectedType === 'official' ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
//         )}>
//           <Building2 className="h-6 w-6" />
//         </div>
//         <div className="text-center">
//           <h3 className="font-semibold text-foreground">Official</h3>
//           <p className="text-xs text-muted-foreground mt-1">
//             Admin & department access
//           </p>
//         </div>
//         {selectedType === 'official' && (
//           <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
//             <svg className="w-2.5 h-2.5 text-accent-foreground" fill="currentColor" viewBox="0 0 20 20">
//               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
//             </svg>
//           </div>
//         )}
//       </button>
//     </div>
//   );
// };
