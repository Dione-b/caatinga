export type ZkInstallProgress = {
  onStatus?: (message: string) => void;
  onDownloadProgress?: (loaded: number, total?: number) => void;
  onDownloadComplete?: () => void;
};
