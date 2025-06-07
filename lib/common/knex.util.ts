import { DEFAULT_CONNECTION_NAME } from "../knex.constants";
import { KnexModuleOptionsI } from "../interfaces";
import { Observable, retry, timer } from "rxjs";
import { Logger } from "@nestjs/common";

const logger = new Logger("KnexModule");

export function getConnectionToken(
  connection: KnexModuleOptionsI | string = DEFAULT_CONNECTION_NAME
): string | Function {
  if (typeof connection === "string") {
    return connection;
  }
  return `${connection.name || DEFAULT_CONNECTION_NAME}`;
}

export function handleRetry(
  maxAttempts = 9,
  retryDelay = 3000
): <T>(source: Observable<T>) => Observable<T> {
  return <T>(source: Observable<T>) =>
    source.pipe(
      retry({
        count: maxAttempts,
        delay: (error: Error, retryCount: number) => {
          logger.error(
            `Unable to connect to the database. Retrying (${retryCount})...`,
            error.stack
          );
          
          if (retryCount >= maxAttempts) {
            throw error;
          }
          
          return timer(retryDelay);
        },
      })
    );
}
