import { parsePaystackMetadata } from './paystack-metadata.util';

describe('parsePaystackMetadata', () => {
  it('parses flat metadata object', () => {
    expect(
      parsePaystackMetadata({
        taskId: 'task-1',
        userId: 'user-1',
        type: 'TASK_PAYMENT',
      }),
    ).toEqual({
      taskId: 'task-1',
      userId: 'user-1',
      type: 'TASK_PAYMENT',
    });
  });

  it('parses JSON string metadata', () => {
    expect(
      parsePaystackMetadata(
        JSON.stringify({ taskId: 'task-1', userId: 'user-1', type: 'TASK_PAYMENT' }),
      ),
    ).toEqual({
      taskId: 'task-1',
      userId: 'user-1',
      type: 'TASK_PAYMENT',
    });
  });

  it('parses custom_fields array metadata', () => {
    expect(
      parsePaystackMetadata({
        custom_fields: [
          { variable_name: 'taskId', value: 'task-1' },
          { variable_name: 'userId', value: 'user-1' },
          { variable_name: 'type', value: 'TASK_PAYMENT' },
        ],
      }),
    ).toEqual({
      taskId: 'task-1',
      userId: 'user-1',
      type: 'TASK_PAYMENT',
    });
  });
});
