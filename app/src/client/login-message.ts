/** Separate wrong credentials from network, rejection, and too many tries. */
export function loginFailureMessage(error: string | undefined, retryAfterMin?: number): string {
  switch (error) {
    case 'network':
      return 'Mất kết nối mạng.';
    case 'csrf':
    case 'forbidden':
    case 'rejected':
      return 'Yêu cầu bị từ chối.';
    case 'rate_limited':
      return 'Thử quá nhiều lần. Đợi rồi thử lại.';
    case 'locked': {
      const min = retryAfterMin && retryAfterMin > 0 ? retryAfterMin : 1;
      return `Tài khoản đang khóa. Thử lại sau ${min} phút.`;
    }
    case 'bad_credentials':
    case 'bad':
      return 'Tên đăng nhập hoặc PIN không đúng.';
    default:
      return 'Yêu cầu bị từ chối.';
  }
}
