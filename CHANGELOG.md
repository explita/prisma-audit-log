# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-12-02

### Added

- Support for `Decimal` type from Prisma, ensuring accurate serialization of decimal values in audit logs
- Logger function now accepts both single and multiple logs for more flexible logging scenarios
- Added `skip` callback to conditionally skip audit logging for specific operations
- Added field filtering to include/exclude specific fields from being logged

### Changed

- Made `createMany` the default behavior for batch operations with automatic fallback to single inserts
- Improved error handling and logging consistency
- Updated documentation with new features and examples

### Fixed

- Fixed issue with Decimal serialization in audit logs
- Improved type safety throughout the codebase
- Ignore updates where only timestamp columns (`updatedAt`/`updated_at`) are modified, reducing noise in audit logs

### Changed

- **BREAKING**: Removed `batchInsert` option - batch processing is now enabled by default for better performance
- Improved log processing to automatically handle batch operations with fallback to single inserts
- Enhanced error handling and logging consistency across all operations

## [0.1.0] - 2025-11-29

### Added

- Initial release of `@explita/prisma-audit-log`
- Support for automatic logging of create, update, and delete operations
- Batch operation support (createMany, updateMany, deleteMany)
- Field-level change tracking
- Context-aware logging with user and request information
- Customizable field masking and data sanitization
- TypeScript support
