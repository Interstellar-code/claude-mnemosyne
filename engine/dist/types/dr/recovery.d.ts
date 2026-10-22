import { type Env } from "../config.js";
export interface RecoveryPaths {
    readonly dataDir: string;
    readonly backupDir: string;
    readonly dbPath: string;
}
export interface BackupMetadata {
    readonly timestamp: string;
    readonly original_size: number;
    readonly backup_size: number;
    readonly db_checksum: string;
    readonly backup_checksum: string;
    readonly compressed: true;
}
export interface BackupResult extends BackupMetadata {
    readonly backup_path: string;
    readonly metadata_path: string;
}
export interface RestoreResult {
    readonly restored: true;
    readonly backup_used: string;
    readonly database_path: string;
    readonly integrity_check: boolean;
}
export interface EmergencyRestoreResult {
    readonly restored: true;
    readonly backup_used: string;
    readonly attempts: number;
}
export interface BackupInfo {
    readonly file: string;
    readonly name: string;
    readonly size: number;
    readonly modified: string;
    readonly metadata?: BackupMetadata;
}
export interface RotateBackupsResult {
    readonly total_backups: number;
    readonly kept: number;
    readonly deleted: number;
    readonly deleted_files: string[];
}
export interface HealthCheckResult {
    readonly database: {
        readonly exists: boolean;
        readonly valid: boolean;
        readonly path: string;
        readonly message: string;
    };
    readonly backups: {
        readonly total: number;
        readonly latest: string | null;
        readonly directory: string;
    };
    readonly status: "healthy" | "unhealthy";
}
export declare function getDefaultPaths(env?: Env): RecoveryPaths;
export declare function createBackup(dbPath?: string | null, backupDir?: string | null): BackupResult;
export declare function restoreBackup(backupPath: string, dbPath?: string | null): RestoreResult;
export declare function emergencyRestore(backupDir?: string | null, dbPath?: string | null): EmergencyRestoreResult;
export declare function verifyIntegrity(dbPath?: string | null): boolean;
export declare function listBackups(backupDir?: string | null): BackupInfo[];
export declare function rotateBackups(backupDir?: string | null, keep?: number): RotateBackupsResult;
export declare function healthCheck(): HealthCheckResult;
export declare class FileNotFoundError extends Error {
    constructor(message: string);
}
export declare function resetRecoveryForTests(): void;
