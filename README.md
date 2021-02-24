# Urban Observatory Data Box

This a **monorepo** for setting up a system (Urban Observatory In a Box) for federated network of sensors and services. It borrows ideas from [UO Sensor Networks](https://urbanobservatory.github.io/standards/) standards and is based on implementations instrumented at [The Newcastle Urban Observatory](https://urbanobservatory.ac.uk/).

---

⚠️ **IMPORTANT**⚠️

This code is work in progress and experimental.

---

## Specification

This repo presents a core infrastructure code used for setting up services for an UO, including brokerage of data from sensing devices, configuration for setting up [RabbitMQ](https://www.rabbitmq.com/), consumers for storage in [timescale](https://www.timescale.com/) database and code for exposing of APIs and socket streams.

## Authors

uo-in-abox has been originally developed by:

- Luke Smith (Newcastle University)

Contributors:

- Aare Puussaar (Newcastle University)

## Deployment

For deployment and usage see [uo-data-skeleton](https://github.com/urbanobservatory/uo-data-skeleton)

## Development

> **NOTE!** Applications often need other services (e.g. `rabbitmq` or `timescaledb`) to be already running and waiting for connections. Some apps also need extra configuration parameters to run in addition to `default config` in the code.

### Without docker

```bash
# setup
npm i # install dependencies

# to run apps
npm run start:{app} [cli options] # e.g. -- --verbose [--configuration=${UO_BROKER_CONFIGURATION}]
```

### With docker

Code is mapped as volumes on docker containers so it is possible to run apps locally using special configuration and [uo-data-skeleton](https://github.com/urbanobservatory/uo-data-skeleton) scripts. Dependencies need to be installed in docker image if `package.json` is changed (initialise code rebuild by using `--build`).

## Code Structure

### `src/shared`

Code shared across all the implementations such as `types`, `ORM` database models.

- ### `src/shared/services`

  Services shared across all applications and broker services. `receiver` does the bulk of the injector script. Also has broker specific services and utility services such as `log`.

- ### `src/shared/brokers`

  Deals with getting data from sensors, APIs and HTTP uploads, and pushes it to queues. Also links to `controllers` and gives it _entity_ and _unity_ names. This is what you would extend if you would want to add a special type of broker handling data from a incoming feed.

### `src/apps`

Configuration and setup for apps for the `uo-instance` for `queue`, `database`, `brokers` and `web` services.

- ### `src/apps/master`

  Contains config for `rabbitMQ` queue server and `timescaledb` database setup, and node injector scripts for consuming the queue.

- ### `src/apps/broker`

  Configurations for broker services and feeds to listen to for data. This is what you would use if you want to add a new broker feed to listen to. Uses `docker-compose` file initiated from [uo-data-skeleton](https://github.com/urbanobservatory/uo-data-skeleton) to build application using by `src/shared/brokers` controller implementations.

- ### `src/apps/web`

  Web Services.

  - ### `src/apps/web/api`

    API codebase to make public REST APIs.

  - ### `src/apps/web/stream`

    Socket stream codebase.

  - ### `src/apps/web/docs`

    OpenAPI documentation generator.

### `src/scripts`

Utility scripts.

## Additional Resources

### `archive`

Folder for uploaded images/files that are served via web `file service`. For example uploaded/downloaded images in `./public`.

### `cache`

Cache folder for `.json` files. For example from classification.

### `docs`

Location of OpenAPI docs generated files.

## License

UO DATA BOX is provided under [MIT](https://github.com/urbanobservatory/uo-data-box/blob/main/LICENSE):

    Copyright (c), 2021 Urban Observatory at Newcastle University, Luke Smith, Aare Puussaar

    <urbanobservatory@ncl.ac.uk>
    <luke.smith@ncl.ac.uk>
    <aare.puussaar@ncl.ac.uk>

    Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    	https://opensource.org/licenses/MIT

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

## Future Ideas

- add configurable schema version to database container
- add generic broker configurations
- make APIDocs configurable
- document logging options
- add auto lint and prettier configurations
