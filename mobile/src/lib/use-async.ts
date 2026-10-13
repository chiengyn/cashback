import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

/**
 * Gọi một hàm async khi mở màn hình, có trạng thái loading/error và hàm reload (dùng cho pull-to-refresh).
 * `fn` phải là tham chiếu ổn định, ví dụ `api.orders`.
 * `refetchOnFocus`: tải lại mỗi khi quay lại màn hình (ví dụ sau khi rút tiền xong quay về tab Ví).
 */
export function useAsync<T>(fn: () => Promise<T>, { refetchOnFocus = false } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const run = useCallback(
    () =>
      fn()
        .then(
          (result) => {
            setData(result);
            setError(null);
          },
          (e: unknown) => setError(e instanceof Error ? e.message : 'Có lỗi xảy ra, bạn thử lại nhé.'),
        )
        .finally(() => setIsLoading(false)),
    [fn],
  );

  useEffect(() => {
    if (!refetchOnFocus) run();
  }, [run, refetchOnFocus]);

  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus) run();
    }, [run, refetchOnFocus]),
  );

  const reload = useCallback(() => {
    setIsLoading(true);
    return run();
  }, [run]);

  return { data, error, isLoading, reload };
}
